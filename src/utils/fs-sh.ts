const commands = {
    mkdir: `mkdir`,
    echo: `echo`,
    recursiveRemove: `rm -rf`,
    git: `git`,
};

const escape = (t: string) => {
    return t.replaceAll(`"`, `\\"`);
};

const isSpecialOp = (obj: Record<string, unknown>) => {
    return !!Object.keys(obj).filter((k) => k.startsWith(`$`)).length;
};

export const createSh = (
    root: string,
    structure: Record<string, unknown>,
    c = [`${commands.recursiveRemove} ${root}`, `${commands.mkdir} ${root}`],
    p = [root]
) => {
    const keys = Object.keys(structure);
    keys.forEach((k) => {
        if (typeof structure[k] === `string`) {
            c.push(`${commands.echo} "${escape(structure[k] as string)}"> ${p.join(`/`)}/${k}`);
        } else if (typeof structure[k] === `object`) {
            // if the object is empty its a folder
            const val = structure[k] as Record<string, unknown>;

            if (isSpecialOp(val) && Object.keys(val).length) {
                // first if block checks for commands
                if (val.hasOwnProperty(`$file`)) {
                    if (typeof val.$file !== `string`) {
                        throw Error(`Invalid file for $file`);
                    } else {
                        c.push(`${commands.echo} "${escape(val.$file)}"> ${p.join(`/`)}/${k}`);
                    }
                } else if (val.hasOwnProperty(`$git`)) {
                    if (typeof val.$git !== `string`) {
                        throw Error(`Invalid url for $git`);
                    } else {
                        c.push(`${commands.git} clone ${val.$git} ${p.join(`/`)}/${k}`);
                    }
                } else if (val.hasOwnProperty(`$custom`)) {
                    if (!val.$url || typeof val.$url !== `string`) {
                        throw Error(`Missing url for $type: ${val[`$type`]}`);
                    } else {
                        c.push(`${commands.git} clone ${val.$url} ${p.join(`/`)}/${k}`);
                    }
                }
                // second if block checks for permissions
            } else {
                c.push(`${commands.mkdir} ${p.join(`/`)}/${k}`);
                p.push(k);

                c = createSh(root, val, c, p);
            }
        }
    });
    p.pop();
    return c;
};
