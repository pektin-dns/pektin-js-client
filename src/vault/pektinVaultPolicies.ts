import { deAbsolute } from "../index.js";
import { ClientName, ManagerName, VaultPolicy } from "./types";

export const pektinOfficerPolicy = (clientName: ClientName): VaultPolicy => {
    return `
path "pektin-ribston-policies/${clientName}/*" {
    capabilities = ["read"]
}`;
};

export const pektinSignerPolicy: VaultPolicy = `
path "pektin-transit/sign/{{identity.entity.metadata.domain}}/sha2-256" {
    capabilities = ["update"]
}`;

export const pektinManagerPolicy = `
path "pektin-confidant-passwords/{{identity.entity.name}}/*" {
    capabilities = ["read"]
}`;

export const pektinConfidantPolicy = (
    clientName: ClientName,
    allowedSigningDomains: string[],
    allowAllSigningDomains: boolean = false
): VaultPolicy => {
    let policy = `
path "pektin-officer-passwords-1/${clientName}/*" {
    capabilities = ["read"]
}`;

    if (allowAllSigningDomains) {
        policy += `
path "pektin-signer-passwords-1/*" {
    capabilities = ["read"]
}`;
    } else {
        allowedSigningDomains.map(domain => {
            policy += `
path "pektin-signer-passwords-1/${deAbsolute(domain)}/*" {
    capabilities = ["read"]
}`;
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
}`;
