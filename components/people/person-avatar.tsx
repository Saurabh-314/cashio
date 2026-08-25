import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { personInitials } from "@/constants/people";
import { cn } from "@/lib/utils";
import type { Person } from "@/types";

export function PersonAvatar({
  person,
  className,
  size = "default",
}: {
  person: Pick<Person, "name" | "avatarUrl">;
  className?: string;
  size?: "default" | "sm" | "lg";
}) {
  return (
    <Avatar size={size} className={cn(className)}>
      {person.avatarUrl ? <AvatarImage src={person.avatarUrl} alt={person.name} /> : null}
      <AvatarFallback>{personInitials(person.name || "?")}</AvatarFallback>
    </Avatar>
  );
}
