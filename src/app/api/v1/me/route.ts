import { api } from "@/lib/api/handler";
import { currentUser } from "@/lib/services/auth";

export const GET = api(async ({ userId }) => currentUser(userId));
