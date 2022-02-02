import zoneFile from "dns-zonefile";
import { supportedRecordTypes } from "../../../utils/index.js";

export const getZoneFromFile = (file: string) /*:PektinZoneData*/ => {
    const parsedFile = zoneFile.parse(file);
    //const records = supportedRecordTypes.forEach();
    return parsedFile;
};
