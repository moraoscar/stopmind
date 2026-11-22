import { z } from 'zod';
import { canonicalizeInput } from '@stopmind/shared';

// Strict Spanish word whitelist — neutralizes LLM01 Prompt Injection characters
// (no quotes, braces, colons, newlines, brackets, or instruction punctuation)
const SAFE_WORD_REGEX = /^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s-]{1,32}$/;
const SAFE_CATEGORY_REGEX = /^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s/-]{2,32}$/;
const SAFE_LETTER_REGEX = /^[A-ZÑ]$/;

const canonicalString = (maxLen: number) =>
  z
    .string()
    .transform((v) => canonicalizeInput(v))
    .pipe(z.string().min(1).max(maxLen));

export const ValidateWordItemSchema = z
  .object({
    id: z.number().int().min(0).max(50),
    category: canonicalString(32).pipe(
      z.string().regex(SAFE_CATEGORY_REGEX, 'Categoría con caracteres no permitidos')
    ),
    word: canonicalString(32).pipe(
      z.string().regex(SAFE_WORD_REGEX, 'Palabra con caracteres no permitidos')
    ),
    letter: z
      .string()
      .transform((v) => canonicalizeInput(v).toUpperCase())
      .pipe(z.string().regex(SAFE_LETTER_REGEX))
      .optional(),
  })
  .strict();

export const ValidateRoundRequestSchema = z
  .object({
    items: z.array(ValidateWordItemSchema).min(1).max(20),
  })
  .strict();

export const HintRequestSchema = z
  .object({
    category: canonicalString(32).pipe(
      z.string().regex(SAFE_CATEGORY_REGEX, 'Categoría inválida')
    ),
    letter: z
      .string()
      .transform((v) => canonicalizeInput(v).toUpperCase())
      .pipe(z.string().regex(SAFE_LETTER_REGEX)),
  })
  .strict();

// Zero-Trust deterministic schema for Gemini JSON output (OWASP LLM05 & API10)
export const GeminiOutputSchema = z
  .object({
    items: z
      .array(
        z.object({
          id: z.number().int().min(0).max(50),
          valid: z.boolean(),
          reason: z
            .string()
            .optional()
            .transform((v) =>
              v
                ? canonicalizeInput(v)
                    .replace(/[<>"'`{}[\]]/g, '')
                    .slice(0, 48)
                : ''
            ),
        })
      )
      .max(25),
  })
  .strict();

export const MAX_PAYLOAD_BYTES = 4096; // 4 KB hard ceiling (OWASP API4 / LLM10)
