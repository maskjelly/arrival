import { Asterisk, Globe, OpenAiLogo, Robot, Sparkle } from '@phosphor-icons/react';
export function ClientMark({ name, size = 18 }: { name: string; size?: number }) {
  const Icon = /ChatGPT|OpenAI|GPTBot|OAI-/i.test(name)
    ? OpenAiLogo
    : /Claude|anthropic/i.test(name)
      ? Asterisk
      : /Perplexity/i.test(name)
        ? Sparkle
        : /Unidentified|unknown/i.test(name)
          ? Globe
          : Robot;
  return (
    <span
      className={`client-mark ${/Claude/i.test(name) ? 'client-claude' : ''}`}
      aria-hidden="true"
    >
      <Icon size={size} weight="regular" />
    </span>
  );
}
