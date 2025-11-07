"use client"

import React from "react"
import { cx } from "class-variance-authority"
import { AnimatePresence, motion } from "motion/react"

import { useClickOutside } from "./hooks/use-click-outside"
import SiriOrb from "@/components/smoothui/ui/SiriOrb"
import TypewriterText from "@/components/smoothui/ui/TypewriterText"

const SPEED = 1

interface FooterContext {
  showFeedback: boolean
  success: boolean
  openFeedback: () => void
  closeFeedback: () => void
}

const FooterContext = React.createContext({} as FooterContext)
const useFooter = () => React.useContext(FooterContext)

export function MorphSurface({
  onSubmit,
  placeholder = "Ask me anything...",
  loading = false,
  disabled = false,
}: {
  onSubmit?: (message: string) => void | Promise<void>
  placeholder?: string
  loading?: boolean
  disabled?: boolean
}) {
  const rootRef = React.useRef<HTMLDivElement>(null)

  const feedbackRef = React.useRef<HTMLTextAreaElement | null>(null)
  const [showFeedback, setShowFeedback] = React.useState(false)
  const [success, setSuccess] = React.useState(false)

  const closeFeedback = React.useCallback(() => {
    setShowFeedback(false)
    feedbackRef.current?.blur()
  }, [])

  const openFeedback = React.useCallback(() => {
    setShowFeedback(true)
    setTimeout(() => {
      feedbackRef.current?.focus()
    })
  }, [])

  const onFeedbackSuccess = React.useCallback(() => {
    closeFeedback()
    setSuccess(true)
    setTimeout(() => {
      setSuccess(false)
    }, 1500)
  }, [closeFeedback])

  useClickOutside(rootRef, closeFeedback)

  const context = React.useMemo(
    () => ({
      showFeedback,
      success,
      openFeedback,
      closeFeedback,
    }),
    [showFeedback, success, openFeedback, closeFeedback]
  )

  return (
    <div
      className="flex items-center justify-center"
      style={{
        width: FEEDBACK_WIDTH,
        height: FEEDBACK_HEIGHT,
      }}
    >
      <motion.div
        data-footer
        ref={rootRef}
        className={cx(
          "bg-background relative bottom-8 z-3 flex flex-col items-center overflow-hidden border max-sm:bottom-5"
        )}
        initial={false}
        animate={{
          width: showFeedback ? FEEDBACK_WIDTH : "auto",
          height: showFeedback ? FEEDBACK_HEIGHT : 44,
          borderRadius: showFeedback ? 14 : 20,
        }}
        transition={{
          type: "spring",
          stiffness: 550 / SPEED,
          damping: 45,
          mass: 0.7,
          delay: showFeedback ? 0 : 0.08,
        }}
      >
        <FooterContext.Provider value={context}>
          <Dock disabled={disabled || loading} loading={loading} />
          <Feedback
            ref={feedbackRef}
            placeholder={placeholder}
            loading={loading}
            disabled={disabled}
            onSubmitExternal={onSubmit}
            onSuccess={onFeedbackSuccess}
          />
        </FooterContext.Provider>
      </motion.div>
    </div>
  )
}

function Dock({ disabled, loading }: { disabled?: boolean; loading?: boolean }) {
  const { showFeedback, openFeedback } = useFooter()
  return (
    <footer className="mt-auto flex h-[44px] items-center justify-center whitespace-nowrap select-none">
      <div className="flex items-center justify-center gap-2 px-3 max-sm:h-10 max-sm:px-2">
        <div className="flex w-fit items-center gap-2">
          <AnimatePresence mode="wait">
            {showFeedback ? (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0 }}
                exit={{ opacity: 0 }}
                className="h-5 w-5"
              />
            ) : (
              <motion.div
                key="siri-orb"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {loading ? (
                  <SiriOrb
                    size="28px"
                    colors={{
                      bg: "oklch(92% 0.03 264.695)",
                      c1: "oklch(70% 0.23 350)",
                      c2: "oklch(75% 0.20 200)",
                      c3: "oklch(72% 0.22 280)",
                    }}
                  />
                ) : (
                  <SiriOrb size="24px" colors={{ bg: "oklch(22.64% 0 0)", c1: "oklch(22.64% 0 0)", c2: "oklch(22.64% 0 0)", c3: "oklch(22.64% 0 0)" }} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          type="button"
          className="flex h-fit flex-1 justify-end rounded-full px-2 !py-0.5 bg-transparent text-current hover:bg-black/5"
          onClick={openFeedback}
          disabled={disabled}
        >
          <span className="truncate">
            {loading ? <TypewriterText speed={5}>Re-imagining...</TypewriterText> : "Re-imagine"}
          </span>
        </button>
      </div>
    </footer>
  )
}

const FEEDBACK_WIDTH = 360
const FEEDBACK_HEIGHT = 200

const Feedback = React.forwardRef<HTMLTextAreaElement, {
  onSuccess: () => void
  onSubmitExternal?: (message: string) => void | Promise<void>
  placeholder?: string
  loading?: boolean
  disabled?: boolean
}>(function Feedback(
  {
    onSuccess,
    onSubmitExternal,
    placeholder,
    loading,
    disabled,
  },
  ref
) {
  const { closeFeedback, showFeedback } = useFooter()
  const submitRef = React.useRef<HTMLButtonElement>(null)
  const [message, setMessage] = React.useState("")

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      if (onSubmitExternal) {
        await onSubmitExternal(message)
      }
      onSuccess()
      setMessage("")
    } catch {
      // let caller handle errors; keep the UI open
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      closeFeedback()
    }
    if (e.key === "Enter" && e.metaKey) {
      e.preventDefault()
      submitRef.current?.click()
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="absolute bottom-0"
      style={{
        width: FEEDBACK_WIDTH,
        height: FEEDBACK_HEIGHT,
        pointerEvents: showFeedback ? "all" : "none",
      }}
    >
      <AnimatePresence>
        {showFeedback && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 550 / SPEED,
              damping: 45,
              mass: 0.7,
            }}
            className="flex h-full flex-col p-1"
          >
            <div className="flex justify-between py-1">
              <p className="text-foreground z-2 ml-[38px] flex items-center gap-[6px] select-none">
                {loading ? <TypewriterText speed={40}>Re-imagining...</TypewriterText> : "Re-imagine"}
              </p>
              <button
                type="submit"
                ref={submitRef}
                className="text-foreground right-4 mt-1 flex -translate-y-[3px] cursor-pointer items-center justify-center gap-1 rounded-[12px] bg-transparent pr-1 text-center select-none"
              >
                <Kbd className="text-foreground bg-white">⌘</Kbd>
                <Kbd className="text-foreground bg-white">Enter</Kbd>
              </button>
            </div>
            <textarea
              ref={ref}
              placeholder={placeholder}
              name="message"
              className="bg-background h-full w-full resize-none scroll-py-2 rounded-md p-4 outline-0"
              required
              disabled={disabled}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={onKeyDown}
              spellCheck={false}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showFeedback && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute top-2 left-3"
          >
            {loading ? (
              <SiriOrb size="24px" />
            ) : (
              <SiriOrb size="24px" colors={{ bg: "oklch(22.64% 0 0)", c1: "oklch(22.64% 0 0)", c2: "oklch(22.64% 0 0)", c3: "oklch(22.64% 0 0)" }} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  )
})

const LOGO_SPRING = {
  type: "spring",
  stiffness: 350 / SPEED,
  damping: 35,
} as const

function Kbd({
  children,
  className,
}: {
  children: string
  className?: string
}) {
  return (
    <kbd
      className={cx(
        "bg-primary text-foreground flex h-6 w-fit items-center justify-center rounded-sm border px-[6px] font-sans",
        className
      )}
    >
      {children}
    </kbd>
  )
}

// Add default export for lazy loading
export default MorphSurface
