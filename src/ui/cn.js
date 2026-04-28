// src/ui/cn.js
//
// Utility para combinar classes Tailwind condicionalmente.
//
// Combina dois pacotes:
//   • clsx — sintaxe limpa pra concatenar classes condicionais
//     ex: cn("base", isActive && "active", { error: hasError })
//   • tailwind-merge — resolve conflitos entre classes Tailwind
//     ex: cn("p-4", "p-2") → "p-2" (sem twMerge ficaria "p-4 p-2"
//     e o browser aplicaria a última, mas o cascade é frágil)
//
// Padrão estabelecido pelo shadcn/ui e adotado pela comunidade React +
// Tailwind como helper de classes desde 2023.
//
// Por que precisa do twMerge:
//
//   function Button({ size, className }) {
//     return <button className={cn("px-4 py-2", className)} />;
//   }
//
//   // Caller passa override:
//   <Button className="px-6" />
//
// Sem twMerge: classe final = "px-4 py-2 px-6". O browser aplica
// o mais específico (que é cascade-based — frágil e dependente de
// ordem do CSS final). Com twMerge: classe final = "py-2 px-6"
// (px-4 detectado como conflito e removido). Comportamento
// previsível e explícito.

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
