import { AuthLinkHandler } from "@/app/auth/auth-link-handler";

export default function HomePage() {
  return <AuthLinkHandler fallbackPath="/login" />;
}
