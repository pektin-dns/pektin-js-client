export const concatDomain = (domain: string, subDomain?: string) => {
    if (subDomain === undefined) return domain;
    return `${subDomain}.${domain}`;
};

export const absoluteName = (name: string) => {
    if (name === undefined) {
        throw Error(
            `Input was undefined. This error indicates an upstream undefined value. Check if all the keys have the right names or use TS.`
        );
    }
    if (name.endsWith(`.`)) {
        return name;
    }
    return name + `.`;
};

export const isAbsolute = (name: string): boolean => name.endsWith(`.`);

export const deAbsolute = (name: string) => {
    if (name.endsWith(`.`)) {
        return name.substring(0, name.length - 1);
    }
    return name;
};
