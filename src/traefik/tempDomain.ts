import { PektinConfig } from "@pektin/config/src/config-types";
import _ from "lodash";
import { concatDomain, TempDomain, toASCII } from "../index.js";
import { getNodesNameservers } from "../pureFunctions.js";
import { externalProxyServices, getNsList } from "./index.js";

export const genTempDomainConfig = ({
    pektinConfig,
    node,
    recursorAuth,
    tempDomain,
    proxyAuth,
}: {
    readonly pektinConfig: PektinConfig;
    readonly node: PektinConfig[`nodes`][0];
    readonly recursorAuth?: string;
    readonly tempDomain: TempDomain;
    readonly proxyAuth?: string;
}) => {
    const nodeNameServers = getNodesNameservers(pektinConfig, node.name);
    if (!nodeNameServers) throw Error(`Could not get NS for node`);
    const enabledServices = Object.values(pektinConfig.services).filter((s) => s.enabled);

    const tempDomainConfig = _.merge(
        genTempServerConf({ nodeNameServers, pektinConfig, tempDomain }),
        ...(node.main
            ? enabledServices.map((s, i) =>
                  genTempPektinServicesConfig({
                      service: Object.keys(pektinConfig.services)[i],
                      subDomain: s.subDomain,
                      pektinConfig,
                      tempDomain,
                  })
              )
            : []),
        ...(node.main
            ? externalProxyServices
                  .filter((p) => pektinConfig.reverseProxy.external.services[p.name])
                  .map((proxy) => genTempProxyConf({ ...proxy, pektinConfig, proxyAuth }))
            : []),
        node.main && recursorAuth
            ? genTempRecursorConf({
                  pektinConfig,
                  recursorAuth,
                  tempDomain,
              })
            : {}
    );

    return tempDomainConfig;
};

export const genTempServerConf = ({
    nodeNameServers,
    pektinConfig,
    tempDomain,
}: {
    nodeNameServers: PektinConfig[`nameservers`];
    pektinConfig: PektinConfig;
    tempDomain?: TempDomain;
}) => {
    const rp = pektinConfig.reverseProxy;

    // whether or not to apply the temp domain
    const ut =
        tempDomain &&
        pektinConfig.reverseProxy.tempPektinZone &&
        pektinConfig.reverseProxy.routing === `domain`;
    if (!ut) return {};
    const tls = rp.tls
        ? {
              certResolver: `tempDomain`,
              domains: [
                  {
                      main: toASCII(concatDomain(tempDomain.zoneDomain, tempDomain.domain)),
                  },
              ],
          }
        : false;

    const nns = nodeNameServers.map((nns) => {
        return { ...nns, domain: toASCII(concatDomain(tempDomain.zoneDomain, tempDomain.domain)) };
    }) as PektinConfig[`nameservers`];

    return {
        tcp: {
            routers: {
                "pektin-server-tcp": {
                    ...(tls && { tls }),
                    rule: `HostSNI(${getNsList(nns, false)})`,
                    entrypoints: `pektin-server-tcp`,
                    service: `pektin-server-tcp`,
                },
            },
        } /*
        as soon as traefik add dtls
        udp: {
            routers: {
                "pektin-server-udp": {
                    ...(tls && { tls }),
                    entrypoints: `pektin-server-udp`,
                    service: `pektin-server-udp`,
                },
            },
        },*/,
        http: {
            routers: {
                "pektin-server-http": {
                    ...(tls && { tls }),
                    rule: (() => {
                        if (rp.routing === `domain`) {
                            return `Host(${getNsList(nns, false)}) && Path(\`/dns-query\`)`;
                        }
                    })(),
                    entrypoints: rp.tls ? `websecure` : `web`,
                    service: `pektin-server-http`,
                },
            },
        },
    };
};

export const genTempRecursorConf = ({
    pektinConfig,
    recursorAuth,
    tempDomain,
}: {
    pektinConfig: PektinConfig;
    recursorAuth: string;
    tempDomain?: TempDomain;
}) => {
    const rp = pektinConfig.reverseProxy;

    // whether or not to apply the temp domain
    const ut =
        tempDomain &&
        pektinConfig.reverseProxy.tempPektinZone &&
        pektinConfig.reverseProxy.routing === `domain`;
    if (!ut) return {};
    const tls = rp.tls
        ? {
              certResolver: `tempDomain`,
              domains: [
                  {
                      main: toASCII(concatDomain(tempDomain.zoneDomain, tempDomain.domain)),
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
                            return `Host(\`${toASCII(
                                concatDomain(
                                    concatDomain(tempDomain.zoneDomain, tempDomain.domain),
                                    pektinConfig.services.recursor.subDomain
                                )
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

export const genTempPektinServicesConfig = ({
    service,
    subDomain,
    pektinConfig,
    tempDomain,
}: {
    service: string;
    subDomain: string;
    pektinConfig: PektinConfig;
    tempDomain?: TempDomain;
}) => {
    const rp = pektinConfig.reverseProxy;

    // whether or not to apply the temp domain
    const ut =
        tempDomain &&
        pektinConfig.reverseProxy.tempPektinZone &&
        pektinConfig.reverseProxy.routing === `domain`;
    if (!ut) return {};
    const tls = rp.tls
        ? {
              certResolver: `tempDomain`,
              domains: [
                  {
                      main: toASCII(concatDomain(tempDomain.zoneDomain, tempDomain.domain)),
                  },
              ],
          }
        : false;

    return {
        http: {
            routers: {
                ...(ut && {
                    [`pektin-temp-${service}`]: {
                        ...(tls && {
                            tls,
                        }),
                        rule: (() => {
                            return `Host(\`${toASCII(
                                concatDomain(
                                    concatDomain(tempDomain.zoneDomain, tempDomain.domain),
                                    subDomain
                                )
                            )}\`)`;
                        })(),
                        service: `pektin-${service}`,
                        entrypoints: rp.tls ? `websecure` : `web`,
                    },
                }),
            },
        },
    };
};

export const genTempProxyConf = ({
    pektinConfig,
    name,
    tempDomain,
    proxyAuth,
}: {
    pektinConfig: PektinConfig;
    name: string;
    tempDomain?: TempDomain;
    proxyAuth?: string;
}) => {
    if (!proxyAuth) return {};
    const rp = pektinConfig.reverseProxy;

    // whether or not to apply the temp domain
    const ut =
        tempDomain &&
        pektinConfig.reverseProxy.tempPektinZone &&
        pektinConfig.reverseProxy.routing === `domain`;
    if (!ut) return {};
    const tls = rp.tls
        ? {
              certResolver: `tempDomain`,
              domains: [
                  {
                      main: toASCII(concatDomain(tempDomain.zoneDomain, tempDomain.domain)),
                  },
              ],
          }
        : false;
    const { subDomain } = rp.external;
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
                            return `Host(\`${toASCII(
                                concatDomain(
                                    concatDomain(tempDomain.zoneDomain, tempDomain.domain),
                                    subDomain
                                )
                            )}\`) && PathPrefix(\`/proxy-${name}\`)`;
                        }
                    })(),
                },
            },
        },
    };
};
