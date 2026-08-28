import { NextResponse } from "next/server";
import pkg from "../../../../../packages/gainmap/package.json";
import { INSTALL_COMMANDS } from "@/lib/install-commands";
import { jsonOk } from "@/lib/api-response";

export async function GET(): Promise<NextResponse> {
  return jsonOk({
    name: pkg.name,
    version: pkg.version,
    installCommands: INSTALL_COMMANDS,
    homebrewFormula: "kirkstrobeck/tap/gainmap",
  });
}
