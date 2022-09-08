import { PektinConfig } from "@pektin/config/src/config-types";
import _ from "lodash";
import yaml from "yaml";
import { concatDomain, emailToASCII, toASCII } from "../../index.js";
import { getNodesNameservers } from "../../pureFunctions.js";
import { TempDomain } from "../../types.js";
import { genTempDomainConfig } from "./tempDomain.js";

export const genTraefikConfs = ({
    pektinConfig,
    node,
    tntAuth,
    tempDomain,
    perimeterAuthHashed,
    proxyBasicAuthHashed,
}: {
    readonly pektinConfig: PektinConfig;
    readonly node: PektinConfig[`nodes`][0];
    readonly tntAuth?: string;
    readonly tempDomain?: TempDomain;
    readonly perimeterAuthHashed?: string;
    readonly proxyBasicAuthHashed?: string;
}) => {
    const nodeNameServers = getNodesNameservers(pektinConfig, node.name);
    if (!nodeNameServers) throw Error(`Could not get NS for node`);

    const dynamicConf = _.merge(
        serverConf({ nodeNameServers, pektinConfig }),
        ...(node.main
            ? Object.values(pektinConfig.services).flatMap((s, i) => {
                  if (
                      /*@ts-ignore*/
                      s.enabled !== false &&
                      s.hasOwnProperty(`domain`) &&
                      Object.keys(pektinConfig.services)[i] !== `tnt` &&
                      Object.keys(pektinConfig.services)[i] !== `server`
                  ) {
                      return [
                          pektinServicesConf({
                              service: Object.keys(pektinConfig.services)[i],
                              /*@ts-ignore*/
                              domain: s.domain,
                              /*@ts-ignore*/
                              subDomain: s.subDomain,
                              pektinConfig,
                              perimeterAuthHashed,
                          }),
                      ];
                  }
                  return [];
              })
            : []),
        ...(node.main
            ? pektinConfig.services.verkehr.external.services
                  .filter((s) => s.enabled)
                  .map((proxy) => proxyConf({ ...proxy, pektinConfig, proxyBasicAuthHashed }))
            : []),
        pektinConfig.services.verkehr.tls ? redirectHttps() : {},
        node.main && tntAuth
            ? tntConf({
                  pektinConfig,
                  tntAuth,
              })
            : {}
    );

    const staticConf = _.merge(genStaticConf(pektinConfig));

    const yamlOptions: yaml.Options = { indent: 4, version: `1.1` };
    const notice = `#THIS FILE WAS GENERATED! DO NOT CHANGE IT UNLESS YOU KNOW WHAT YOU'RE DOING!\n`;
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
                        tntAuth,
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
    const rp = pektinConfig.services.verkehr;

    return {
        tcp: {
            routers: {
                "pektin-server-tcp": {
                    rule: `HostSNI(${getNsList(nodeNameServers, `domain`)})`,
                    entrypoints: [`pektin-server-tcp`],
                    service: `pektin-server-tcp`,
                },
            },
            services: {
                "pektin-server-tcp": {
                    loadbalancer: {
                        servers: [
                            {
                                address: `pektin-server:53`,
                            },
                        ],
                    },
                },
            },
        },
        /*
        as soon as traefik adds dtls
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
                    entrypoints: [rp.tls ? `websecure` : `web`],
                    service: `pektin-server-http`,
                },
            },
            services: {
                "pektin-server-http": {
                    loadbalancer: {
                        servers: [
                            {
                                url: `http://pektin-server`,
                            },
                        ],
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
    perimeterAuthHashed,
}: {
    service: string;
    domain: string;
    subDomain: string;
    pektinConfig: PektinConfig;
    perimeterAuthHashed?: string;
}) => {
    const rp = pektinConfig.services.verkehr;

    domain = toASCII(domain);
    subDomain = toASCII(subDomain);

    return {
        http: {
            ...(rp.tls
                ? {
                      entrypoints: {
                          websecure: {
                              address: `:443`,
                              certResolver: {
                                  fallbackDomain: domain,
                                  resolverType: `zertificat`,
                              },
                          },
                          web: {
                              address: `:80`,
                          },
                      },
                  }
                : {
                      entrypoints: {
                          web: {
                              address: `:80`,
                          },
                      },
                  }),
            routers: {
                [`pektin-${service}`]: {
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
                    /*@ts-ignore*/
                    ...(pektinConfig.services[service].perimeterAuth &&
                        perimeterAuthHashed && {
                            middlewares: [`pektin-perimeter-auth`],
                        }),
                    entrypoints: [rp.tls ? `websecure` : `web`],
                },
            },
            services: {
                [`pektin-${service}`]: {
                    loadbalancer: {
                        servers: [
                            {
                                url: `http://pektin-${service}`,
                            },
                        ],
                    },
                },
            },
            /*@ts-ignore*/
            ...(pektinConfig.services[service].perimeterAuth &&
                perimeterAuthHashed && {
                    middlewares: {
                        "pektin-perimeter-auth": {
                            basicAuth: {
                                users: [perimeterAuthHashed],
                            },
                        },
                    },
                }),
        },
    };
};

export const proxyConf = ({
    pektinConfig,
    name,
    domain,
    accessControlAllowMethods,
    accessControlAllowHeaders,
    proxyBasicAuthHashed,
}: {
    pektinConfig: PektinConfig;
    name: string;
    domain: string;
    accessControlAllowMethods: string[];
    accessControlAllowHeaders: string[];
    proxyBasicAuthHashed?: string;
}) => {
    const rp = pektinConfig.services.verkehr;
    const internalDomain = toASCII(rp.external.domain);
    const subDomain = toASCII(rp.external.subDomain);

    return {
        http: {
            routers: {
                [`pektin-proxy-${name}`]: {
                    entrypoints: [rp.tls ? `websecure` : `web`],
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
                    loadbalancer: {
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
                        regex: `^\/proxy-[^/]+`,
                    },
                },
                [`pektin-proxy-cors-${name}`]: {
                    cors: {
                        methods: accessControlAllowMethods.join(`, `),
                        origin: `*`,
                        age: 86400,
                        headers: [...accessControlAllowHeaders, `ProxyBasicAuth`].join(`, `),
                    },
                },
                "pektin-proxy-auth": {
                    basicAuth: {
                        customAuthField: `ProxyBasicAuth`,
                        users: [proxyBasicAuthHashed],
                    },
                },
            },
        },
    };
};

export const tntConf = ({
    pektinConfig,
    tntAuth,
}: {
    pektinConfig: PektinConfig;
    tntAuth: string;
}) => {
    const rp = pektinConfig.services.verkehr;
    const domain = toASCII(pektinConfig.services.tnt.domain);
    const fullDomain = toASCII(
        concatDomain(pektinConfig.services.tnt.domain, pektinConfig.services.tnt.subDomain)
    );

    return {
        http: {
            routers: {
                "pektin-tnt": {
                    rule: (() => {
                        if (rp.routing === `domain`) {
                            return `Host(\`${fullDomain}\`)`;
                        }
                        if (rp.routing === `local`) {
                            return `Host(\`${concatDomain(`localhost`, fullDomain)}\`)`;
                        }
                        if (rp.routing === `minikube`) {
                            return `Host(\`${concatDomain(`minikube`, fullDomain)}\`)`;
                        }
                    })(),
                    service: `pektin-tnt`,
                    entrypoints: [rp.tls ? `websecure` : `web`],
                    middlewares: [`pektin-tnt-cors`, `pektin-tnt-auth`],
                },
            },
            middlewares: {
                "pektin-tnt-cors": {
                    cors: {
                        methods: `OPTIONS, POST`,
                        origin: `*`,
                        headers: `authorization, content-type`,
                        age: 86400,
                    },
                },
                "pektin-tnt-auth": {
                    basicAuth: {
                        users: [tntAuth],
                    },
                },
            },
            services: {
                "pektin-tnt": {
                    loadbalancer: {
                        servers: [
                            {
                                url: `http://pektin-tnt`,
                            },
                        ],
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
                    rule: `hostregexp(\`.+\`)`,
                    entrypoints: [`web`],
                    middlewares: [`redirect-to-https`],
                },
            },
            middlewares: {
                "redirect-to-https": {
                    redirectScheme: {
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
        log: {
            level: `DEBUG`,
        },
        metrics: {
            prometheus: {},
        },
        tracing: {
            jaeger: {
                localAgentHostPort: `pektin-jaeger:6831`,
            },
        },
        providers: {
            docker: {
                exposedbydefault: false,
            },
            file: {
                directory: `/verkehr/dynamic/`,
                watch: true,
            },
        },
    };
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
