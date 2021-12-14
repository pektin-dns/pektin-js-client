import { deAbsolute } from "..";

export const pektinSignerPolicy = `
path "pektin-transit/sign/{{identity.entity.metadata.domain}}/sha2-256" {
    capabilities = ["update"]
}`;

export const pektinClientPolicy = (
    clientName: string,
    allowedDomains: string[],
    allowAllDomains: boolean = false
) => {
    let policy = `
path "pektin-officer-passwords-1/${clientName}" {
    capabilities = ["read"]
}
`;
    if (allowAllDomains) {
        policy += `
    path "pektin-signer-passwords-1/*" {
        capabilities = ["read"]
    }
    `;
    } else {
        allowedDomains.map(domain => {
            policy += `
        path "pektin-signer-passwords-1/${deAbsolute(domain)}" {
            capabilities = ["read"]
        }
        `;
        });
    }

    return policy;
};
export const pektinApiPolicy = `
path "pektin-signer-passwords-2/*" {
    capabilities = ["read"]
}

path "pektin-officer-passwords-2/*" {
    capabilities = ["read"]
}
`;
