import { createAdminClient } from "@/lib/supabase/admin";

export class DuplicateSubscriberError extends Error {
  constructor() {
    super("Email already subscribed");
    this.name = "DuplicateSubscriberError";
  }
}

export async function subscribeToNewsletter(email: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("newsletter_subscribers").insert({ email });

  if (error) {
    if (error.code === "23505") {
      throw new DuplicateSubscriberError();
    }
    throw error;
  }
}
