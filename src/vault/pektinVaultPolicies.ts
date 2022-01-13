import { deAbsolute } from "../index.js";
import { ClientName } from "../types.js";
import { VaultPolicy } from "./types";

export const pektinOfficerPolicy = `
path "pektin-ribston-policies/data/{{identity.entity.metadata.clientName}}" {
    capabilities = ["read"]
}`;

export const pektinSignerPolicy: VaultPolicy = `
path "pektin-transit/sign/{{identity.entity.metadata.domain}}/sha2-256" {
    capabilities = ["update"]
}`;

export const pektinConfidantPolicy = (
    clientName: ClientName,
    allowedSigningDomains: string[],
    allowAllSigningDomains: boolean = false
): VaultPolicy => {
    let policy = `
path "pektin-officer-passwords-1/data/${clientName}" {
    capabilities = ["read"]
}

path "pektin-kv/data/pektin-config" {
    capabilities = ["read"]
}`;

    if (allowAllSigningDomains) {
        policy += `
path "pektin-signer-passwords-1/data/*" {
    capabilities = ["read"]
}`;
    } else {
        allowedSigningDomains.map(domain => {
            policy += `
path "pektin-signer-passwords-1/data/${deAbsolute(domain)}" {
    capabilities = ["read"]
}`;
        });
    }

    return policy as VaultPolicy;
};
export const pektinApiPolicy: VaultPolicy = `
path "pektin-signer-passwords-2/data/*" {
    capabilities = ["read"]
}

path "pektin-officer-passwords-2/data/*" {
    capabilities = ["read"]
}`;
