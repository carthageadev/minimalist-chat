"use client"

import React from "react"
import { cx } from "class-variance-authority"
import { AnimatePresence, motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface OrbProps {
  dimension?: string
  className?: string
  tones?: {
    base?: string
    accent1?: string
    accent2?: string
    accent3?: string
  }
  spinDuration?: number
}

const ColorOrb: React.FC<OrbProps> = ({
  dimension = "192px",
  className,
  tones,
  spinDuration = 20,
}) => {
  const fallbackTones = {
    base: "oklch(95% 0.02 264.695)",
    accent1: "oklch(75% 0.15 350)",
    accent2: "oklch(80% 0.12 200)",
    accent3: "oklch(78% 0.14 280)",
  }

  const palette = { ...fallbackTones, ...tones }
  const dimValue = parseInt(dimension.replace("px", ""), 10)

  const blurStrength =
    dimValue < 50 ? Math.max(dimValue * 0.008, 1) : Math.max(dimValue * 0.015, 4)

  const contrastStrength =
    dimValue < 50 ? Math.max(dimValue * 0.004, 1.2) : Math.max(dimValue * 0.008, 1.5)

  const pixelDot = dimValue < 50 ? Math.max(dimValue * 0.004, 0.05) : Math.max(dimValue * 0.008, 0.1)

  const shadowRange = dimValue < 50 ? Math.max(dimValue * 0.004, 0.5) : Math.max(dimValue * 0.008, 2)

  const maskRadius =
    dimValue < 30 ? "0%" : dimValue < 50 ? "5%" : dimValue < 100 ? "15%" : "25%"

  const adjustedContrast =
    dimValue < 30 ? 1.1 : dimValue < 50 ? Math.max(contrastStrength * 1.2, 1.3) : contrastStrength

  return (
    <div
      className={cn("color-orb", className)}
      style={{
        width: dimension,
        height: dimension,
        "--base": palette.base,
        "--accent1": palette.accent1,
        "--accent2": palette.accent2,
        "--accent3": palette.accent3,
        "--spin-duration": `${spinDuration}s`,
        "--blur": `${blurStrength}px`,
        "--contrast": adjustedContrast,
        "--dot": `${pixelDot}px`,
        "--shadow": `${shadowRange}px`,
        "--mask": maskRadius,
      } as React.CSSProperties}
    >
      <div className="orb-inner" />
    </div>
  )
}

const SPEED_FACTOR = 1

interface ContextShape {
  showForm: boolean
  successFlag: boolean
  triggerOpen: () => void
  triggerClose: () => void
}

const FormContext = React.createContext({} as ContextShape)
const useFormContext = () => React.useContext(FormContext)

export function MorphPanel() {
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)

  const [showForm, setShowForm] = React.useState(false)
  const [successFlag, setSuccessFlag] = React.useState(false)

  const triggerClose = React.useCallback(() => {
    setShowForm(false)
    textareaRef.current?.blur()
  }, [])

  const triggerOpen = React.useCallback(() => {
    setShowForm(true)
    setTimeout(() => {
      textareaRef.current?.focus()
    })
  }, [])

  const handleSuccess = React.useCallback(() => {
    triggerClose()
    setSuccessFlag(true)
    setTimeout(() => setSuccessFlag(false), 1500)
  }, [triggerClose])

  React.useEffect(() => {
    function clickOutsideHandler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node) && showForm) {
        triggerClose()
      }
    }
    document.addEventListener("mousedown", clickOutsideHandler)
    return () => document.removeEventListener("mousedown", clickOutsideHandler)
  }, [showForm, triggerClose])

  const ctx = React.useMemo(
    () => ({ showForm, successFlag, triggerOpen, triggerClose }),
    [showForm, successFlag, triggerOpen, triggerClose]
  )

  return (
    <div className="flex items-center justify-center" style={{ width: FORM_WIDTH, height: 44 }}>
      <motion.div
        ref={wrapperRef}
        data-panel
        className={cx(
          "bg-black/80 backdrop-blur-xl relative z-[100] flex flex-col items-center overflow-hidden border border-white/10 shadow-2xl"
        )}
        initial={false}
        animate={{
          width: showForm ? FORM_WIDTH : 120,
          height: showForm ? FORM_HEIGHT : 44,
          borderRadius: showForm ? 14 : 22,
        }}
        transition={{
          type: "spring",
          stiffness: 550 / SPEED_FACTOR,
          damping: 45,
          mass: 0.7,
          delay: showForm ? 0 : 0.08,
        }}
      >
        <FormContext.Provider value={ctx}>
          <DockBar />
          <InputForm ref={textareaRef} onSuccess={handleSuccess} />
        </FormContext.Provider>
      </motion.div>
    </div>
  )
}

function DockBar() {
  const { showForm, triggerOpen } = useFormContext()
  return (
    <footer className="mt-auto flex h-[44px] items-center justify-center whitespace-nowrap select-none">
      <div className="flex items-center justify-center gap-2 px-3">
        <div className="flex w-fit items-center gap-2">
          <AnimatePresence mode="wait">
            {showForm ? null : (
              <motion.div
                key="orb"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
              >
                <ColorOrb dimension="20px" tones={{ base: "oklch(100% 0 0)" }} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!showForm && (
          <Button
            type="button"
            className="flex h-fit flex-1 justify-end rounded-full px-2 !py-0.5 text-white/50 hover:text-white"
            variant="ghost"
            onClick={triggerOpen}
          >
            <span className="truncate text-xs tracking-widest font-light">ASK AI</span>
          </Button>
        )}
      </div>
    </footer>
  )
}

const FORM_WIDTH = 360
const FORM_HEIGHT = 200

function InputForm({ ref, onSuccess }: { ref: React.Ref<HTMLTextAreaElement>; onSuccess: () => void }) {
  const { triggerClose, showForm } = useFormContext()
  const btnRef = React.useRef<HTMLButtonElement>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    onSuccess()
  }

  function handleKeys(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") triggerClose()
    if (e.key === "Enter" && e.metaKey) {
      e.preventDefault()
      btnRef.current?.click()
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("absolute inset-0 transition-opacity duration-300", showForm ? "opacity-100" : "opacity-0 pointer-events-none")}
      style={{ width: FORM_WIDTH, height: FORM_HEIGHT }}
    >
      <div className="flex h-full flex-col p-2">
        <div className="flex justify-between items-center px-2 py-1">
          <div className="flex items-center gap-2">
            <ColorOrb dimension="20px" tones={{ base: "oklch(100% 0 0)" }} />
            <p className="text-white/40 text-[10px] tracking-[0.2em] uppercase font-light select-none">
              AI Input
            </p>
          </div>
          <button
            type="submit"
            ref={btnRef}
            className="text-white/20 hover:text-white/60 transition-colors flex items-center gap-2 rounded-[12px] bg-transparent text-center select-none"
          >
            <KeyHint>⌘</KeyHint>
            <KeyHint className="w-fit">Enter</KeyHint>
          </button>
        </div>
        <textarea
          ref={ref}
          placeholder="Ask me anything..."
          name="message"
          className="flex-1 w-full resize-none scroll-py-2 rounded-md p-4 outline-0 bg-transparent text-white text-sm placeholder:text-white/20"
          required
          onKeyDown={handleKeys}
          spellCheck={false}
        />
      </div>
    </form>
  )
}

function KeyHint({ children, className }: { children: string; className?: string }) {
  return (
    <kbd
      className={cx(
        "text-white/30 flex h-6 w-fit items-center justify-center rounded-sm border border-white/10 px-[6px] font-sans text-[9px]",
        className
      )}
    >
      {children}
    </kbd>
  )
}

export default MorphPanel
