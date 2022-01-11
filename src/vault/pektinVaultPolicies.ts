import { deAbsolute } from "../index.js";
import { VaultPolicy } from "./types";

export const pektinOfficerPolicy = (officerName: string): VaultPolicy => {
    return `
path "pektin-ribston-policies/${officerName}" {
    capabilities = ["read"]
}
`;
};

export const pektinSignerPolicy: VaultPolicy = `
path "pektin-transit/sign/{{identity.entity.metadata.domain}}/sha2-256" {
    capabilities = ["update"]
}`;

export const pektinClientPolicy = (
    clientName: string,
    allowedSigningDomains: string[],
    allowAllSigningDomains: boolean = false
): VaultPolicy => {
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
