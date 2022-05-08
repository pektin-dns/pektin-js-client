import { PektinConfig } from "@pektin/config/src/config-types";
import _ from "lodash";
import { concatDomain, TempDomain, toASCII } from "../../index.js";
import { getNodesNameservers } from "../../pureFunctions.js";
import { getNsList } from "./traefik.js";

export const genTempDomainConfig = ({
    pektinConfig,
    node,
    tntAuth,
    tempDomain,
}: {
    readonly pektinConfig: PektinConfig;
    readonly node: PektinConfig[`nodes`][0];
    readonly tntAuth?: string;
    readonly tempDomain: TempDomain;
}) => {
    const nodeNameServers = getNodesNameservers(pektinConfig, node.name);
    if (!nodeNameServers) throw Error(`Could not get NS for node`);
    const enabledServices = Object.values(pektinConfig.services).filter(
        /*@ts-ignore*/
        (s) => s.enabled !== false && s.hasOwnProperty(`domain`)
    );

    const tempDomainConfig = _.merge(
        genTempServerConf({ nodeNameServers, pektinConfig, tempDomain }),
        ...(node.main
            ? enabledServices.map((s, i) =>
                  genTempPektinServicesConfig({
                      service: Object.keys(pektinConfig.services)[i],
                      /*@ts-ignore*/
                      subDomain: s.subDomain,
                      pektinConfig,
                      tempDomain,
                  })
              )
            : []),
        ...(node.main
            ? pektinConfig.reverseProxy.external.services
                  .filter((s) => s.enabled)
                  .map((proxy) => genTempProxyConf({ ...proxy, pektinConfig }))
            : []),
        node.main && tntAuth
            ? genTempTntConf({
                  pektinConfig,
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
        pektinConfig.reverseProxy.tempZone.enabled &&
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
                "pektin-temp-server-tcp": {
                    ...(tls && { tls }),
                    rule: `HostSNI(${getNsList(nns, `domain`)})`,
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
                "pektin-temp-server-http": {
                    ...(tls && { tls }),
                    rule: (() => {
                        if (rp.routing === `domain`) {
                            return `Host(${getNsList(nns, `domain`)}) && Path(\`/dns-query\`)`;
                        }
                    })(),
                    entrypoints: rp.tls ? `websecure` : `web`,
                    service: `pektin-server-http`,
                },
            },
        },
    };
};

export const genTempTntConf = ({
    pektinConfig,
    tempDomain,
}: {
    pektinConfig: PektinConfig;
    tempDomain?: TempDomain;
}) => {
    const rp = pektinConfig.reverseProxy;

    // whether or not to apply the temp domain
    const ut =
        tempDomain &&
        pektinConfig.reverseProxy.tempZone.enabled &&
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
                "pektin-temp-tnt": {
                    ...(tls && { tls }),
                    rule: (() => {
                        if (rp.routing === `domain`) {
                            return `Host(\`${toASCII(
                                concatDomain(
                                    concatDomain(tempDomain.zoneDomain, tempDomain.domain),
                                    pektinConfig.services.tnt.subDomain
                                )
                            )}\`) && Path(\`/dns-query\`)`;
                        }
                    })(),
                    entrypoints: rp.tls ? `websecure` : `web`,
                    middlewares: [`pektin-tnt-cors`, `pektin-tnt-auth`],
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
        pektinConfig.reverseProxy.tempZone.enabled &&
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
}: {
    pektinConfig: PektinConfig;
    name: string;
    tempDomain?: TempDomain;
}) => {
    const rp = pektinConfig.reverseProxy;

    // whether or not to apply the temp domain
    const ut =
        tempDomain &&
        pektinConfig.reverseProxy.tempZone.enabled &&
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
                [`pektin-temp-proxy-${name}`]: {
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
