import * as React from "react"
import {
  Command as CommandRoot,
  CommandInput as CommandInputPrimitive,
  CommandList as CommandListPrimitive,
  CommandEmpty as CommandEmptyPrimitive,
  CommandGroup as CommandGroupPrimitive,
  CommandItem as CommandItemPrimitive,
} from "cmdk"
import { SearchIcon } from "lucide-react"
import { cn } from "@/lib/utils"

function Command({ className, ...props }) {
  return (
    <CommandRoot
      data-slot="command"
      className={cn(
        "bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md",
        className
      )}
      {...props}
    />
  )
}

function CommandInput({ className, ...props }) {
  return (
    <div data-slot="command-input-wrapper" className="flex items-center gap-2 border-b px-3">
      <SearchIcon className="size-4 shrink-0 opacity-50" />
      <CommandInputPrimitive
        data-slot="command-input"
        className={cn(
          "placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    </div>
  )
}

function CommandList({ className, ...props }) {
  return (
    <CommandListPrimitive
      data-slot="command-list"
      className={cn("max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto", className)}
      {...props}
    />
  )
}

function CommandEmpty({ ...props }) {
  return (
    <CommandEmptyPrimitive
      data-slot="command-empty"
      className="py-6 text-center text-sm"
      {...props}
    />
  )
}

function CommandGroup({ className, ...props }) {
  return (
    <CommandGroupPrimitive
      data-slot="command-group"
      className={cn(
        "text-foreground overflow-hidden p-1 [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium",
        className
      )}
      {...props}
    />
  )
}

function CommandItem({ className, ...props }) {
  return (
    <CommandItemPrimitive
      data-slot="command-item"
      className={cn(
        "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem }
