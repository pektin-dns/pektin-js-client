import { PektinConfig } from "@pektin/config/src/config-types";
import _ from "lodash";
import yaml from "yaml";
import { concatDomain, emailToASCII, toASCII } from "../index.js";
import { getNodesNameservers } from "../pureFunctions.js";
import { TempDomain } from "../types.js";
import { genTempDomainConfig } from "./tempDomain.js";

// TODO add traefik UI with auth

export const genTraefikConfs = ({
    pektinConfig,
    node,
    recursorAuth,
    tempDomain,
    proxyAuth,
}: {
    readonly pektinConfig: PektinConfig;
    readonly node: PektinConfig[`nodes`][0];
    readonly recursorAuth?: string;
    readonly tempDomain?: TempDomain;
    readonly proxyAuth?: string;
}) => {
    const nodeNameServers = getNodesNameservers(pektinConfig, node.name);
    if (!nodeNameServers) throw Error(`Could not get NS for node`);
    const enabledServices = Object.values(pektinConfig.services).filter(
        /*@ts-ignore*/
        (s) => s.enabled !== false && s.hasOwnProperty(`domain`)
    );

    const dynamicConf = _.merge(
        serverConf({ nodeNameServers, pektinConfig }),
        ...(node.main
            ? enabledServices.map((s, i) =>
                  pektinServicesConf({
                      service: Object.keys(pektinConfig.services)[i],
                      /*@ts-ignore*/
                      domain: s.domain,
                      /*@ts-ignore*/
                      subDomain: s.subDomain,
                      pektinConfig,
                  })
              )
            : []),
        ...(node.main
            ? pektinConfig.reverseProxy.external.services
                  .filter((s) => s.enabled)
                  .map((proxy) => proxyConf({ ...proxy, pektinConfig, proxyAuth }))
            : []),
        tlsConfig(pektinConfig),
        pektinConfig.reverseProxy.traefikUi.enabled && traefikUiConf(pektinConfig),
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
                    rule: `HostSNI(${getNsList(nodeNameServers, `domain`)})`,
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
                                `domain`
                            )}) && Path(\`/dns-query\`)`;
                        }
                        if (rp.routing === `local`) {
                            return `Host(${getNsList(
                                nodeNameServers,
                                `local`
                            )}) && Path(\`/dns-query\`)`;
                        }
                        if (rp.routing === `minikube`) {
                            return `Host(${getNsList(
                                nodeNameServers,
                                `minikube`
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
                        if (rp.routing === `minikube`) {
                            return `Host(\`${concatDomain(
                                `minikube`,
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

export const proxyConf = ({
    pektinConfig,
    name,
    domain,
    accessControlAllowMethods,
    proxyAuth,
}: {
    pektinConfig: PektinConfig;
    name: string;
    domain: string;
    accessControlAllowMethods: string[];
    proxyAuth?: string;
}) => {
    if (!proxyAuth) return {};
    const rp = pektinConfig.reverseProxy;
    const internalDomain = toASCII(rp.external.domain);
    const subDomain = toASCII(rp.external.subDomain);

    const tls = rp.tls
        ? {
              certResolver: `default`,
              domains: [{ main: internalDomain, sans: [`*.${internalDomain}`] }],
          }
        : false;
    return {
        http: {
            routers: {
                [`pektin-proxy-${name}`]: {
                    ...(tls && { tls }),
                    entrypoints: rp.tls ? `websecure` : `web`,
                    middlewares: [
                        `pektin-proxy-strip-proxy`,
                        `pektin-proxy-cors-${name}`,
                        `pektin-proxy-auth`,
                    ],
                    service: `pektin-proxy-${name}`,
                    rule: (() => {
                        if (rp.routing === `domain`) {
                            return `Host(\`${concatDomain(
                                internalDomain,
                                subDomain
                            )}\`) && PathPrefix(\`/proxy-${name}\`)`;
                        }
                        if (rp.routing === `local`) {
                            return `Host(\`${concatDomain(
                                `localhost`,
                                concatDomain(internalDomain, subDomain)
                            )}\`) && PathPrefix(\`/proxy-${name}\`)`;
                        }
                        if (rp.routing === `minikube`) {
                            return `Host(\`${concatDomain(
                                `minikube`,
                                concatDomain(internalDomain, subDomain)
                            )}\`) && PathPrefix(\`/proxy-${name}\`)`;
                        }
                    })(),
                },
            },
            services: {
                [`pektin-proxy-${name}`]: {
                    loadBalancer: {
                        passHostHeader: false,
                        servers: [
                            {
                                url: `https://${domain}`,
                            },
                        ],
                    },
                },
            },
            middlewares: {
                "pektin-proxy-strip-proxy": {
                    stripPrefixRegex: {
                        regex: [`^\/proxy-[^/]+`],
                    },
                },
                [`pektin-proxy-cors-${name}`]: {
                    headers: {
                        accessControlAllowMethods: accessControlAllowMethods.join(`,`),
                        accessControlAllowOriginList: `*`,
                        accessControlMaxAge: 86400,
                    },
                },
                "pektin-proxy-auth": { basicauth: { users: proxyAuth } },
            },
        },
    };
};

export const traefikUiConf = (pektinConfig: PektinConfig) => {
    const rp = pektinConfig.reverseProxy;
    let domain = pektinConfig.reverseProxy.traefikUi.domain;
    let subDomain = pektinConfig.reverseProxy.traefikUi.subDomain;

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
                "traefik-api": {
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
                        if (rp.routing === `minikube`) {
                            return `Host(\`${concatDomain(
                                `minikube`,
                                concatDomain(domain, subDomain)
                            )}\`)`;
                        }
                    })(),
                    entrypoints: rp.tls ? `websecure` : `web`,
                    service: `api@internal`,
                },
            },
        },
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
                        if (rp.routing === `minikube`) {
                            return `Host(\`${concatDomain(
                                `minikube`,
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
                        accessControlAllowOriginList: `*`,
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
        ...(pektinConfig.reverseProxy.traefikUi.enabled && { api: { dashboard: true } }),
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
                        email: emailToASCII(pektinConfig.letsencrypt.letsencryptEmail),
                        storage: `/letsencrypt/default.json`,
                    },
                },
                ...(pektinConfig.reverseProxy.tempZone.enabled && {
                    tempDomain: {
                        acme: {
                            email: emailToASCII(pektinConfig.letsencrypt.letsencryptEmail),
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

export const getNsList = (
    nodeNameServers: PektinConfig[`nameservers`],
    routing: `local` | `domain` | `minikube`
) => {
    let sni = ``;
    if (nodeNameServers) {
        nodeNameServers.forEach((ns, i) => {
            if (i > 0) sni += `,`;
            sni += `\`${
                routing === `local` || routing === `minikube`
                    ? toASCII(
                          concatDomain(
                              routing === `local` ? `localhost` : `minikube`,
                              concatDomain(ns.domain, ns.subDomain)
                          )
                      )
                    : toASCII(concatDomain(ns.domain, ns.subDomain))
            }\``;
        });
    }
    return sni;
};
