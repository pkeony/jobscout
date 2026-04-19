"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Skill } from "@/types";

export function SkillBadge({ skill }: { skill: Skill }) {
  const variant =
    skill.category === "required"
      ? "default"
      : skill.category === "preferred"
        ? "secondary"
        : "outline";

  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge variant={variant} className="cursor-default">
          {skill.name}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="text-xs">{skill.context}</p>
        {skill.level !== "unspecified" && (
          <p className="text-xs text-muted-foreground mt-1">
            요구 수준: {skill.level}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
