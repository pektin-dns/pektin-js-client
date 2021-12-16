import { deAbsolute } from "../index.js";
import { VaultPolicy } from "./types.js";

export const pektinSignerPolicy: VaultPolicy = `
path "pektin-transit/sign/{{identity.entity.metadata.domain}}/sha2-256" {
    capabilities = ["update"]
}`;

export const pektinClientPolicy = (
    clientName: string,
    allowedSigningDomains: string[],
    allowAllSigningDomains: boolean = false
) => {
    let policy = `
path "pektin-officer-passwords-1/${clientName}" {
    capabilities = ["read"]
}
`;
    if (allowAllSigningDomains) {
        policy += `
    path "pektin-signer-passwords-1/*" {
        capabilities = ["read"]
    }
    `;
    } else {
        allowedSigningDomains.map(domain => {
            policy += `
        path "pektin-signer-passwords-1/${deAbsolute(domain)}" {
            capabilities = ["read"]
        }
        `;
        });
    }

    return policy as VaultPolicy;
};
export const pektinApiPolicy: VaultPolicy = `
path "pektin-signer-passwords-2/*" {
    capabilities = ["read"]
}

path "pektin-officer-passwords-2/*" {
    capabilities = ["read"]
}
`;
