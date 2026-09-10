import { AuthLinkHandler } from "@/app/auth/auth-link-handler";

export default function AuthCallbackPage() {
    return <AuthLinkHandler fallbackPath="/login" />;
}
