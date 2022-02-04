import { PektinConfig } from "@pektin/config/src/config-types";
import _ from "lodash";
import yaml from "yaml";
import { concatDomain } from "../index.js";
import { getNodesNameservers } from "../pureFunctions.js";

const externalProxyServices: { name: `gandi` | `crt`; url: string; allowedMethods: string }[] = [
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

export const traefikConf = (
    pektinConfig: PektinConfig,
    node: PektinConfig[`nodes`][0],
    recursorAuth?: string
) => {
    const nodeNameServers = getNodesNameservers(pektinConfig, node.name);
    if (!nodeNameServers) throw Error(`Could not get NS for node`);
    const enabledServices = Object.values(pektinConfig.services).filter((s) => s.enabled);

    const p = externalProxyServices
        .filter((p) => pektinConfig.reverseProxy.external.services[p.name])
        .map((proxy) => proxyConf({ ...proxy, pektinConfig }));

    const s = enabledServices.map((s, i) =>
        pektinServicesConf({
            service: Object.keys(pektinConfig.services)[i],
            domain: s.domain,
            subDomain: s.subDomain,
            pektinConfig,
        })
    );
    const config = _.merge(
        serverConf({ nodeNameServers, pektinConfig }),
        ...(node.main ? s : []),
        ...(node.main ? p : []),
        tlsOptions,
        otherOptions,
        pektinConfig.reverseProxy.tls ? redirectHttps() : {},
        node.main && recursorAuth
            ? recursorConf({
                  pektinConfig,
                  recursorAuth,
              })
            : {}
    );

    return yaml.stringify(config, { indent: 4 });
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
                  return { main: ns.domain, sans: [`*.${ns.domain}`] };
              }),
          }
        : false;
    return {
        tcp: {
            routers: {
                "pektin-server-tcp": {
                    tls,
                    rule: `HostSNI(${getNsList(nodeNameServers)})`,
                    entrypoints: `server-tcp`,
                    service: `pektin-server-tcp`,
                },
            },
            services: {
                "pektin-server-tcp": {
                    loadbalancer: { servers: [{ hostname: `pektin-server`, port: 53 }] }, //! maybe this has to be address: ip-adress of the server
                },
            },
        },
        udp: {
            routers: {
                "pektin-server-udp": {
                    tls,
                    entrypoints: `server-udp`,
                    service: `pektin-server-udp`,
                },
            },
            services: {
                "pektin-server-udp": {
                    loadbalancer: { servers: [{ hostname: `pektin-server`, port: 53 }] }, //! maybe this has to be address: ip-adress of the server
                },
            },
        },
        http: {
            routers: {
                "pektin-server-http": {
                    tls,
                    rule: (() => {
                        if (rp.routing === `domain`) {
                            return `Host(${getNsList(nodeNameServers)}) && Path(\`/dns-query\`)`;
                        }
                        if (rp.routing === `localIpAndPath` || rp.routing === `publicIpAndPath`) {
                            return `PathPrefix(${getNsList(nodeNameServers, `/dns-query`)})`;
                        }
                    })(),
                    entrypoints: rp.tls ? `websecure` : `web`,
                    service: `pektin-server-http`,
                    middlewares: rp.routing === `domain` ? [] : [`stripDomainPath`],
                },
            },
            services: {
                "pektin-server-http": {
                    loadbalancer: { servers: [{ url: `http://pektin-server` }] },
                },
            },
            middlewares: {
                stripDomainPath: {
                    stripprefixregex: {
                        regex: `/^\/[^/]*/`,
                    },
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
                    tls,
                    rule: (() => {
                        if (rp.routing === `domain`) {
                            return `Host(\`${concatDomain(domain, subDomain)}\`)`;
                        }
                        if (rp.routing === `localIpAndPath` || rp.routing === `publicIpAndPath`) {
                            return `PathPrefix(\`/${concatDomain(domain, subDomain)}\`)`;
                        }
                    })(),
                    service: `pektin-${service}`,
                    entrypoints: rp.tls ? `websecure` : `web`,
                    middlewares: rp.routing === `domain` ? [] : [`stripDomainPath`],
                },
            },
            services: {
                [`pektin-${service}`]: {
                    loadbalancer: { servers: [{ url: `http://pektin-${service}` }] },
                },
            },
            middlewares: {
                stripDomainPath: {
                    stripprefixregex: {
                        regex: `/^\/[^/]*/`,
                    },
                },
            },
        },
    };
};

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
    const { domain, subDomain } = rp.external;
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
                    tls,
                    entrypoints: rp.tls ? `websecure` : `web`,
                    middlewares:
                        rp.routing === `domain`
                            ? [`strip-proxy`, `cors-${name}`]
                            : [`stripDomainPath`, `strip-proxy`, `cors-${name}`],
                    service: `proxy-${name}`,
                    rule: (() => {
                        if (rp.routing === `domain`) {
                            return `Host(\`${concatDomain(
                                domain,
                                subDomain
                            )}\`) && PathPrefix(\`/proxy-${name}\`)`;
                        }
                        if (rp.routing === `localIpAndPath` || rp.routing === `publicIpAndPath`) {
                            return `PathPrefix(\`/${concatDomain(
                                domain,
                                subDomain
                            )}/proxy-${name}\`)`;
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
                    stripprefixregex: {
                        regex: `/^\/proxy-[^/]{1,}/`,
                    },
                },
                [`cors-${name}`]: {
                    headers: {
                        accessControlAllowMethods: allowedMethods,
                        accessControlAllowOriginlist: `*`,
                        accessControlMaxAge: 86400,
                    },
                },
                stripDomainPath: {
                    stripprefixregex: {
                        regex: `/^\/[^/]*/`,
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
    const domain = pektinConfig.services.recursor.domain;
    const fullDomain = concatDomain(
        pektinConfig.services.recursor.domain,
        pektinConfig.services.recursor.subDomain
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
                    tls,
                    rule: (() => {
                        if (rp.routing === `domain`) {
                            return `Host(${fullDomain}) && Path(\`/dns-query\`)`;
                        }
                        if (rp.routing === `localIpAndPath` || rp.routing === `publicIpAndPath`) {
                            return `PathPrefix(\`/${fullDomain}/dns-query\`)`;
                        }
                    })(),
                    entrypoints: rp.tls ? `websecure` : `web`,
                    middlewares:
                        rp.routing === `domain`
                            ? [`pektin-recursor-cors`, `pektin-recursor-auth`]
                            : [`pektin-recursor-cors`, `pektin-recursor-auth`, `stripDomainPath`],
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
                stripDomainPath: {
                    stripprefixregex: {
                        regex: `/^\/[^/]*/`,
                    },
                },
            },
            services: {
                "pektin-recursor": {
                    loadbalancer: {
                        servers: {
                            port: 80,
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

export const otherOptions = {
    docker: {
        network: `rp`,
    },
};

export const tlsOptions = {
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
        stores: {
            default: {
                defaultCertificate: {
                    certFile: `/letsencrypt/pem/cert.pem`,
                    keyFile: `/letsencrypt/pem/key.pem`,
                },
            },
        },
    },
};

export const getNsList = (nodeNameServers: PektinConfig[`nameservers`], path?: string) => {
    let sni = ``;
    if (nodeNameServers) {
        nodeNameServers.forEach((ns, i) => {
            if (i > 0) sni += `,`;
            sni += `\`${path ? `/` : ``}${concatDomain(ns.domain, ns.subDomain)}${
                path ? path : ``
            }\``;
        });
    }
    return sni;
};
