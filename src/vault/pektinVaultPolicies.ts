import { ClientCapabilities } from "../types.js";
import { deAbsolute } from "../utils/index.js";
import { VaultPolicy } from "./types.js";

export const pektinServerAdminManagerPolicy: VaultPolicy = `
path "auth/userpass/*" {
    capabilities = ["create", "read", "update", "delete", "list"]
}
path "pektin-kv/*" {
    capabilities = ["create", "read", "update", "delete", "list"]
}
path "pektin-transit/*" {
    capabilities = ["create", "read", "update", "delete", "list"]
}
path "identity/*" {
    capabilities = ["create", "read", "update", "delete", "list"]
}
path "sys/auth" {
    capabilities = ["create", "read", "update", "delete", "list"]
}
`;

export const pektinZertificatManagerPolicy: VaultPolicy = `path "pektin-zertificat/*" {
    capabilities = ["create", "read", "update", "delete", "list"]
}
path "pektin-kv/data/pektin-config" {
    capabilities = ["read"]
}`;

export const pektinZertificatConsumerPolicy: VaultPolicy = `path "pektin-zertificat/*" {
    capabilities = ["read", "list"]
}`;

export const pektinConfidantPolicy = (capabilities: ClientCapabilities): VaultPolicy => {
    let policy = ``;
    if (capabilities.allAccess) {
        policy += `
path "pektin-kv/data/*" {
    capabilities = ["read"]
}`;
    } else {
        if (capabilities.configAccess) {
            policy += `
path "pektin-kv/data/pektin-config" {
    capabilities = ["read"]
}`;
        }

        if (capabilities.tntAccess) {
            policy += `
path "pektin-kv/data/tnt-auth" {
    capabilities = ["read"]
}`;
        }
        if (capabilities.proxyAccess) {
            policy += `
path "pektin-kv/data/proxy-auth" {
    capabilities = ["read"]
}`;
        }
    }
    if (capabilities.allowAllSigningDomains) {
        policy += `
path "pektin-transit/keys/*" {
    capabilities = ["read"]
}
`;
    } else if (capabilities.allowedSigningDomains) {
        capabilities.allowedSigningDomains.map((domain) => {
            policy += `
path "pektin-transit/keys/${deAbsolute(domain)}-zsk" {
    capabilities = ["read"]
}

path "pektin-transit/keys/${deAbsolute(domain)}-ksk" {
    capabilities = ["read"]
}`;
        });
    }

    return policy as VaultPolicy;
};
export const pektinApiPolicy: VaultPolicy = `
path "pektin-policies/data/*" {
    capabilities = ["read"]
}

path "pektin-transit/*" {
    capabilities = ["update","read"]
}`;
