import "server-only";

import { customAdapter } from "./cms/custom";
import { ghostAdapter } from "./cms/ghost";
import { wordpressAdapter } from "./cms/wordpress";
import { brevoAdapter } from "./email/brevo";
import { gmailAdapter } from "./email/gmail";
import { microsoftAdapter } from "./email/microsoft";
import type {
  ConnectMethod,
  ContentDestinationAdapter,
  DestinationId,
  DestinationKind,
} from "./types";

/**
 * Every destination Architecta knows about, in settings-UI order: the places
 * content is published first, then the places it's sent. Adapters are
 * registered as they land; an unregistered entry renders as "coming soon"
 * rather than disappearing, mirroring the social registry's `implemented` flag.
 */
export const DESTINATION_ORDER: DestinationId[] = [
  "wordpress",
  "ghost",
  "custom",
  "gmail",
  "microsoft",
  "brevo",
];

export const DESTINATION_META: Record<
  DestinationId,
  { label: string; kind: DestinationKind; connectMethod: ConnectMethod }
> = {
  wordpress: { label: "WordPress", kind: "cms", connectMethod: "credentials" },
  ghost: { label: "Ghost", kind: "cms", connectMethod: "credentials" },
  custom: { label: "Custom site", kind: "cms", connectMethod: "credentials" },
  gmail: { label: "Gmail", kind: "email", connectMethod: "oauth" },
  microsoft: { label: "Outlook", kind: "email", connectMethod: "oauth" },
  brevo: { label: "Brevo", kind: "email", connectMethod: "credentials" },
};

const ADAPTERS: Partial<Record<DestinationId, ContentDestinationAdapter>> = {
  wordpress: wordpressAdapter,
  ghost: ghostAdapter,
  custom: customAdapter,
  gmail: gmailAdapter,
  microsoft: microsoftAdapter,
  brevo: brevoAdapter,
};

export function isDestinationId(value: string): value is DestinationId {
  return value in DESTINATION_META;
}

export function getAdapter(destination: DestinationId): ContentDestinationAdapter | null {
  return ADAPTERS[destination] ?? null;
}

/** One entry per destination, whether or not its adapter has landed. */
export function listDestinations() {
  return DESTINATION_ORDER.map((destination) => {
    const meta = DESTINATION_META[destination];
    const adapter = ADAPTERS[destination];
    return {
      destination,
      label: meta.label,
      kind: meta.kind,
      connectMethod: meta.connectMethod,
      implemented: adapter?.implemented ?? false,
    };
  });
}
