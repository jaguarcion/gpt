import { Moon, Sun } from "lucide-react"
import { useTheme } from "./ThemeProvider"

export function ModeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <button
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === "light" ? (
        <Sun className="h-5 w-5 text-zinc-900 dark:text-zinc-100" />
      ) : (
        <Moon className="h-5 w-5 text-zinc-900 dark:text-zinc-100" />
      )}
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}