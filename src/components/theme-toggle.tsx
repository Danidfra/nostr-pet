import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className={cn(
            "relative transition-all duration-300 ease-in-out",
            "hover:shadow-elegant hover:scale-105 hover:border-primary/30",
            "active:scale-95",
            "focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
            "bg-card/50 backdrop-blur-sm",
            "hover:glow-warm"
          )}
        >
          <Sun className={cn(
            "h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all duration-300",
            "dark:-rotate-90 dark:scale-0",
            "text-amber-500 dark:text-amber-400"
          )} />
          <Moon className={cn(
            "absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all duration-300",
            "dark:rotate-0 dark:scale-100",
            "text-blue-400 dark:text-blue-300"
          )} />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className={cn(
          "shadow-elegant-lg border-border/50 backdrop-blur-sm",
          "bg-popover/95"
        )}
      >
        <DropdownMenuItem 
          onClick={() => setTheme("light")}
          className={cn(
            "cursor-pointer transition-all duration-200",
            "hover:bg-accent/80 focus:bg-accent/80",
            "rounded-md",
            theme === "light" && "bg-primary/10 text-primary font-medium"
          )}
        >
          <Sun className="mr-2 h-4 w-4 text-amber-500" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme("dark")}
          className={cn(
            "cursor-pointer transition-all duration-200",
            "hover:bg-accent/80 focus:bg-accent/80",
            "rounded-md",
            theme === "dark" && "bg-primary/10 text-primary font-medium"
          )}
        >
          <Moon className="mr-2 h-4 w-4 text-blue-400" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme("system")}
          className={cn(
            "cursor-pointer transition-all duration-200",
            "hover:bg-accent/80 focus:bg-accent/80",
            "rounded-md",
            theme === "system" && "bg-primary/10 text-primary font-medium"
          )}
        >
          <Monitor className="mr-2 h-4 w-4 text-muted-foreground" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Simple toggle version (just light/dark, no system option)
export function SimpleThemeToggle() {
  const { setTheme, theme } = useTheme();

  const toggleTheme = () => {
    if (theme === "dark") {
      setTheme("light");
    } else {
      setTheme("dark");
    }
  };

  return (
    <Button variant="outline" size="icon" onClick={toggleTheme}>
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}