import crypto from "crypto";

import { promisify } from "util";
import { exec as exec_default } from "child_process";
const exec = promisify(exec_default);

export const randomString = (length = 100) => {
    return crypto.randomBytes(length).toString("base64url").replaceAll("=", "");
};

export const chmod = async (path: string, perms: string) => {
    await exec(`chmod ${perms} ${path}`);
};

export const chown = async (path: string, uid: string, gid: string) => {
    await exec(`chown ${uid}:${gid} ${path}`);
};

export const chownRecursive = async (path: string, uid: string, gid: string) => {
    await exec(`chown -R ${uid}:${gid} ${path}`);
};
