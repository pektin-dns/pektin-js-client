type ClientName = string;
type DomainName = string;
type ManagerName = `pektin-client-manager-${ClientName}`;
type ConfidantName = `pektin-client-confidant-${ClientName}`;
type SignerName = `pektin-signer-${DomainName}`;
type OfficerName = `pektin-officer-${ClientName}`;

export type VaultPolicy = string;

export interface VaultAuthEngine {
    path: string;
    options: VaultAuthEngineOptions;
}

export interface VaultAuthEngineOptions {
    type: VaultAuthEngineType;
    options?: {};
}
export type VaultAuthEngineType = "approle" | "jwt" | "token" | "userpass";

export type VaultSecretEngineType = "kv" | "transit";

export interface VaultSecretEngine {
    path: string;
    options: VaultSecretEngineOptions;
}

export interface VaultSecretEngineOptions {
    type: VaultSecretEngineType;
    options?: {
        version: number;
    };
}

// https://www.vaultproject.io/api-docs/secret/identity/entity#create-an-entity
export interface IdentityEntityDataRequestBody {
    name?: string;
    id?: string;
    metadata?: object;
    policies?: string[];
    disabled?: boolean;
}

// https://www.vaultproject.io/api-docs/secret/identity/entity-alias#canonical_id
export interface IdentityEntityAliasRequestBody {
    name: string;
    id?: string;
    canonical_id: string; //Entity ID to which this alias belongs to.
    mount_accessor: string; //Accessor of the mount to which the alias should belong to.
    custom_metadata?: object;
}
