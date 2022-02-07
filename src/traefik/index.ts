import { PektinConfig } from "@pektin/config/src/config-types";
import _ from "lodash";
import yaml from "yaml";
import { concatDomain, emailToASCII, toASCII } from "../index.js";
import { getNodesNameservers } from "../pureFunctions.js";
import { TempDomain } from "../types.js";
import { genTempDomainConfig } from "./tempDomain.js";

// TODO fix everything for IDNs

export const externalProxyServices: {
    name: `gandi` | `crt`;
    url: string;
    allowedMethods: string;
}[] = [
    {
        name: `gandi`,
        url: `https://api.gandi.net/v5`,
        allowedMethods: `OPTIONS, POST, GET, DELETE`,
    },
    {
        name: `crt`,
        url: `https://crt.sh`,
        allowedMethods: `OPTIONS, GET`,
    },
];

export const genTraefikConfs = ({
    pektinConfig,
    node,
    recursorAuth,
    tempDomain,
}: {
    readonly pektinConfig: PektinConfig;
    readonly node: PektinConfig[`nodes`][0];
    readonly recursorAuth?: string;
    readonly tempDomain?: TempDomain;
}) => {
    const nodeNameServers = getNodesNameservers(pektinConfig, node.name);
    if (!nodeNameServers) throw Error(`Could not get NS for node`);
    const enabledServices = Object.values(pektinConfig.services).filter((s) => s.enabled);

    const dynamicConf = _.merge(
        serverConf({ nodeNameServers, pektinConfig }),
        ...(node.main
            ? enabledServices.map((s, i) =>
                  pektinServicesConf({
                      service: Object.keys(pektinConfig.services)[i],
                      domain: s.domain,
                      subDomain: s.subDomain,
                      pektinConfig,
                  })
              )
            : []),
        ...(node.main
            ? externalProxyServices
                  .filter((p) => pektinConfig.reverseProxy.external.services[p.name])
                  .map((proxy) => proxyConf({ ...proxy, pektinConfig }))
            : []),
        tlsConfig(pektinConfig),
        pektinConfig.reverseProxy.tls ? redirectHttps() : {},
        node.main && recursorAuth
            ? recursorConf({
                  pektinConfig,
                  recursorAuth,
              })
            : {}
    );
    const staticConf = _.merge(genStaticConf(pektinConfig));

    const yamlOptions: yaml.Options = { indent: 4, version: `1.1` };
    const notice = `#THIS FILE IS GENERATED! DO NOT CHANGE IT UNLESS YOU KNOW WHAT YOU'RE DOING!\n`;
    return {
        dynamic: notice + yaml.stringify(dynamicConf, yamlOptions),
        static: notice + yaml.stringify(staticConf, yamlOptions),
        ...(tempDomain && {
            tempDomain:
                notice +
                yaml.stringify(
                    genTempDomainConfig({
                        pektinConfig,
                        node,
                        recursorAuth,
                        tempDomain,
                    }),
                    yamlOptions
                ),
        }),
    };
};
export const serverConf = ({
    nodeNameServers,
    pektinConfig,
}: {
    nodeNameServers: PektinConfig[`nameservers`];
    pektinConfig: PektinConfig;
}) => {
    const rp = pektinConfig.reverseProxy;

    const tls = rp.tls
        ? {
              certResolver: `default`,
              domains: nodeNameServers.map((ns) => {
                  return { main: toASCII(ns.domain), sans: [`*.${toASCII(ns.domain)}`] };
              }),
          }
        : false;
    return {
        tcp: {
            routers: {
                "pektin-server-tcp": {
                    ...(tls && { tls }),
                    rule: `HostSNI(${getNsList(nodeNameServers, false)})`,
                    entrypoints: `pektin-server-tcp`,
                    service: `pektin-server-tcp`,
                },
            },
            services: {
                "pektin-server-tcp": {
                    loadbalancer: { servers: [{ address: `pektin-server:53` }] },
                },
            },
        },
        /*
        as soon as traefik add dtls
        udp: {
            routers: {
                "pektin-server-udp": {
                    ...(tls && { tls }),
                    entrypoints: `pektin-server-udp`,
                    service: `pektin-server-udp`,
                },
            },
            services: {
                "pektin-server-udp": {
                    loadbalancer: { servers: [{ address: `pektin-server:53` }] },
                },
            },
        },*/
        http: {
            routers: {
                "pektin-server-http": {
                    ...(tls && { tls }),
                    rule: (() => {
                        if (rp.routing === `domain`) {
                            return `Host(${getNsList(
                                nodeNameServers,
                                false
                            )}) && Path(\`/dns-query\`)`;
                        }
                        if (rp.routing === `local`) {
                            return `Host(${getNsList(
                                nodeNameServers,
                                true
                            )}) && Path(\`/dns-query\`)`;
                        }
                    })(),
                    entrypoints: rp.tls ? `websecure` : `web`,
                    service: `pektin-server-http`,
                },
            },
            services: {
                "pektin-server-http": {
                    loadbalancer: { servers: [{ url: `http://pektin-server` }] },
                },
            },
        },
    };
};

export const pektinServicesConf = ({
    service,
    domain,
    subDomain,
    pektinConfig,
}: {
    service: string;
    domain: string;
    subDomain: string;
    pektinConfig: PektinConfig;
}) => {
    const rp = pektinConfig.reverseProxy;

    domain = toASCII(domain);
    subDomain = toASCII(subDomain);
    const tls = rp.tls
        ? {
              certResolver: `default`,
              domains: [{ main: domain, sans: [`*.${domain}`] }],
          }
        : false;
    return {
        http: {
            routers: {
                [`pektin-${service}`]: {
                    ...(tls && { tls }),
                    rule: (() => {
                        if (rp.routing === `domain`) {
                            return `Host(\`${concatDomain(domain, subDomain)}\`)`;
                        }
                        if (rp.routing === `local`) {
                            return `Host(\`${concatDomain(
                                `localhost`,
                                concatDomain(domain, subDomain)
                            )}\`)`;
                        }
                    })(),
                    service: `pektin-${service}`,
                    entrypoints: rp.tls ? `websecure` : `web`,
                },
            },
            services: {
                [`pektin-${service}`]: {
                    loadbalancer: { servers: [{ url: `http://pektin-${service}` }] },
                },
            },
        },
    };
};

//TODO check that nothing relies on domain names being absolute or not absolute

export const proxyConf = ({
    pektinConfig,
    name,
    url,
    allowedMethods,
}: {
    pektinConfig: PektinConfig;
    name: string;
    url: string;
    allowedMethods: string;
}) => {
    const rp = pektinConfig.reverseProxy;
    const domain = toASCII(rp.external.domain);
    const subDomain = toASCII(rp.external.subDomain);

    const tls = rp.tls
        ? {
              certResolver: `default`,
              domains: [{ main: domain, sans: [`*.${domain}`] }],
          }
        : false;
    return {
        http: {
            routers: {
                [`proxy-${name}`]: {
                    ...(tls && { tls }),
                    entrypoints: rp.tls ? `websecure` : `web`,
                    middlewares: [`strip-proxy`, `cors-${name}`],
                    service: `proxy-${name}`,
                    rule: (() => {
                        if (rp.routing === `domain`) {
                            return `Host(\`${concatDomain(
                                domain,
                                subDomain
                            )}\`) && PathPrefix(\`/proxy-${name}\`)`;
                        }
                        if (rp.routing === `local`) {
                            return `Host(\`${concatDomain(
                                `localhost`,
                                concatDomain(domain, subDomain)
                            )}\`) && PathPrefix(\`/proxy-${name}\`)`;
                        }
                    })(),
                },
            },
            services: {
                [`proxy-${name}`]: {
                    loadBalancer: {
                        passHostHeader: false,
                        servers: [
                            {
                                url,
                            },
                        ],
                    },
                },
            },
            middlewares: {
                "strip-proxy": {
                    stripPrefixRegex: {
                        regex: [`^\/proxy-[^/]{1,}`],
                    },
                },
                [`cors-${name}`]: {
                    headers: {
                        accessControlAllowMethods: allowedMethods,
                        accessControlAllowOriginlist: `*`,
                        accessControlMaxAge: 86400,
                    },
                },
            },
        },
    };
};

export const apiConf = () => {
    return {
        http: { routers: { api: { rule: `Host()`, entrypoints: `web`, service: `api@internal` } } },
    };
};

export const recursorConf = ({
    pektinConfig,
    recursorAuth,
}: {
    pektinConfig: PektinConfig;
    recursorAuth: string;
}) => {
    const rp = pektinConfig.reverseProxy;
    const domain = toASCII(pektinConfig.services.recursor.domain);
    const fullDomain = toASCII(
        concatDomain(
            pektinConfig.services.recursor.domain,
            pektinConfig.services.recursor.subDomain
        )
    );
    const tls = rp.tls
        ? {
              certResolver: `default`,
              domains: [
                  {
                      main: domain,
                      sans: [`*.${domain}`],
                  },
              ],
          }
        : false;
    return {
        http: {
            routers: {
                "pektin-recursor": {
                    ...(tls && { tls }),
                    rule: (() => {
                        if (rp.routing === `domain`) {
                            return `Host(\`${fullDomain}\`) && Path(\`/dns-query\`)`;
                        }
                        if (rp.routing === `local`) {
                            return `Host(\`${concatDomain(
                                `localhost`,
                                fullDomain
                            )}\`) && Path(\`/dns-query\`)`;
                        }
                    })(),
                    entrypoints: rp.tls ? `websecure` : `web`,
                    middlewares: [`pektin-recursor-cors`, `pektin-recursor-auth`],
                },
            },
            middlewares: {
                "pektin-recursor-cors": {
                    headers: {
                        accessControlAllowMethods: `GET,OPTIONS,POST`,
                        accessControlAllowOriginlist: `*`,
                        accessControlAllowHeaders: `authorization,content-type`,
                        accessControlMaxAge: 86400,
                    },
                },
                "pektin-recursor-auth": { basicauth: { users: recursorAuth } },
            },
            services: {
                "pektin-recursor": {
                    loadbalancer: {
                        servers: {
                            schema: `h2c`,
                            url: `http://pektin-recursor`,
                        },
                    },
                },
            },
        },
    };
};

export const redirectHttps = () => {
    return {
        http: {
            routers: {
                "http-catchall": {
                    rule: `hostregexp(\`{host:.+}\`)`,
                    entrypoints: `web`,
                    middlewares: `redirect-to-https`,
                },
            },
            middlewares: {
                "redirect-to-https": {
                    redirectscheme: {
                        scheme: `https`,
                        permanent: true,
                    },
                },
            },
        },
    };
};

export const genStaticConf = (pektinConfig: PektinConfig) => {
    return {
        docker: {
            network: `rp`,
        },
        providers: {
            docker: { exposedbydefault: false },
            file: { directory: `/traefik/dynamic/`, watch: true },
        },
        ...(pektinConfig.reverseProxy.tls && { experimental: { http3: true } }),
        entryPoints: {
            "pektin-server-tcp": { address: `:853/tcp` },
            // "pektin-server-udp": { address: `:853/udp` },
            web: { address: `:80/tcp` },
            ...(pektinConfig.reverseProxy.tls && { websecure: { address: `:443`, http3: {} } }),
        },
        ...(pektinConfig.reverseProxy.tls && {
            certificatesresolvers: {
                default: {
                    acme: {
                        dnschallenge: { provider: `pektin` },
                        email: emailToASCII(pektinConfig.certificates.letsencryptEmail),
                        storage: `/letsencrypt/default.json`,
                    },
                },
                ...(pektinConfig.reverseProxy.tempPektinZone && {
                    tempDomain: {
                        acme: {
                            email: emailToASCII(pektinConfig.certificates.letsencryptEmail),
                            storage: `/letsencrypt/tempDomain.json`,
                            httpChallenge: {
                                entryPoint: `web`,
                            },
                        },
                    },
                }),
            },
        }),
    };
};

export const tlsConfig = (pektinConfig: PektinConfig) => {
    return {
        ...(pektinConfig.reverseProxy.tls && {
            tls: {
                options: {
                    default: {
                        minVersion: `VersionTLS12`,
                        cipherSuites: [
                            `TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256`,
                            `TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384`,
                            `TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256`,
                        ],
                    },
                },
            },
        }),
    };
    /*
    config.stores = {
        default: {
            defaultCertificate: {
                certFile: `/letsencrypt/pem/cert.pem`,
                keyFile: `/letsencrypt/pem/key.pem`,
            },
        },
    };*/
};

export const getNsList = (nodeNameServers: PektinConfig[`nameservers`], local: boolean) => {
    let sni = ``;
    if (nodeNameServers) {
        nodeNameServers.forEach((ns, i) => {
            if (i > 0) sni += `,`;
            sni += `\`${
                local
                    ? toASCII(concatDomain(`localhost`, concatDomain(ns.domain, ns.subDomain)))
                    : toASCII(concatDomain(ns.domain, ns.subDomain))
            }\``;
        });
    }
    return sni;
};
