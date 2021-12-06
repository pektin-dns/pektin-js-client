export type VaultSecretEngines = "kv" | "transit";
export type VaultAuthenticationMethods = "approle" | "jwt" | "token" | "userpass";

export interface VaultSecretEngineOptions {
    type: VaultSecretEngines;
    options: {
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
