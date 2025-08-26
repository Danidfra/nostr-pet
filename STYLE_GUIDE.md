<!---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->
<!---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->
<!---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->
<!---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->
<!---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->
<!---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------->

# Blobbi UI – Style Guide (Light & Dark)

> **V1** — Baseado no estilo que você mostrou (cartões com fundo translúcido, bordas roxas, blur e tipografia em tons de cinza). Quando você enviar o estilo específico de _light mode_ e o outro card de referência, eu atualizo este arquivo.

---

## 🎨 Paleta base (tokens)

```css
:root {
  --blobbi-border-light: #E9D5FF;
  --blobbi-border-dark:  #7E22CE;

  --blobbi-bg-light: rgba(255, 255, 255, 0.8);
  --blobbi-bg-dark:  rgba(31, 41, 55, 0.8);

  --blobbi-text-strong-light: #111827;
  --blobbi-text-strong-dark:  #F3F4F6;
  --blobbi-text-muted-light:  #4B5563;
  --blobbi-text-muted-dark:   #9CA3AF;

  --blobbi-yellow-500: #F59E0B;
  --blobbi-yellow-600: #CA8A04;
  --blobbi-amber-500:  #F59E0B;
  --blobbi-pink-500:   #EC4899;
  --blobbi-blue-500:   #3B82F6;
  --blobbi-green-500:  #10B981;
  --blobbi-purple-500: #8B5CF6;
}
```

---

## 🧊 Efeitos e aspectos visuais

```css
.blobbi-card {
  backdrop-filter: blur(4px);
  border-radius: 0.75rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--blobbi-border-light);
  background: var(--blobbi-bg-light);
  color: var(--blobbi-text-strong-light);
}

.dark .blobbi-card {
  border-color: var(--blobbi-border-dark);
  background: var(--blobbi-bg-dark);
  color: var(--blobbi-text-strong-dark);
}

.blobbi-section {
  padding: 1.5rem;
}

.blobbi-muted {
  color: var(--blobbi-text-muted-light);
}
.dark .blobbi-muted {
  color: var(--blobbi-text-muted-dark);
}

.blobbi-hover {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.blobbi-hover:hover {
  transform: scale(1.02);
  box-shadow: 0 8px 24px rgba(168, 85, 247, 0.1);
}
```

---

## 🏷️ Badges / Chips

```css
.blobbi-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid var(--blobbi-border-light);
  color: #7E22CE;
  border-radius: 9999px;
  background: transparent;
}

.dark .blobbi-badge {
  border-color: var(--blobbi-border-dark);
  color: #C4B5FD;
}

.blobbi-badge-soft-amber {
  border-color: transparent;
  background: #FEF3C7;
  color: #92400E;
}
.dark .blobbi-badge-soft-amber {
  background: #78350F;
  color: #FDE68A;
}
```

---

## 🔘 Botões (neutro + variantes)

```css
.blobbi-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  justify-content: flex-start;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: 1px solid var(--blobbi-border-light);
  background: transparent;
  color: inherit;
  transition: background-color 0.2s ease;
}
.blobbi-btn:hover {
  background: rgba(0, 0, 0, 0.03);
}

.dark .blobbi-btn {
  border-color: var(--blobbi-border-dark);
}
```

---

## 🖼️ Cores para ícones

```css
.icon-yellow   { color: var(--blobbi-yellow-600); }
.icon-amber    { color: var(--blobbi-amber-500); }
.icon-pink     { color: var(--blobbi-pink-500); }
.icon-blue     { color: var(--blobbi-blue-500); }
.icon-green    { color: var(--blobbi-green-500); }
.icon-purple   { color: var(--blobbi-purple-500); }
```


---

## ☀️ Light Mode Specific Enhancements

```css
/* Fundo branco quase opaco */
.blobbi-card-light {
  background-color: rgba(255, 255, 255, 0.9); /* bg-white/90 */
  border-color: rgba(233, 213, 255, 0.6);     /* border-purple-200/60 */
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);   /* shadow-sm */
}
.blobbi-card-light:hover {
  box-shadow: 0 12px 24px rgba(233, 213, 255, 0.2); /* hover:shadow-purple-200/20 */
}

/* Texto principal */
.blobbi-text {
  color: #111827; /* text-gray-900 */
}
.blobbi-text-muted {
  color: #4B5563; /* text-gray-600 */
}

/* Badge lilás suave (ex: baby) */
.blobbi-badge-purple-soft {
  background-color: rgba(243, 232, 255, 0.5); /* bg-purple-50/50 */
  color: #7E22CE;                            /* text-purple-700 */
  border-color: rgba(233, 213, 255, 1);      /* border-purple-200 */
}

/* Container com gradiente suave (área do pet) */
.blobbi-gradient-container {
  background-image: linear-gradient(to bottom right, rgba(243,232,255,0.8), rgba(252,231,243,0.8)); /* from-purple-50/80 to-pink-50/80 */
  border: 2px solid rgba(233, 213, 255, 0.6);
  border-radius: 1rem;
  transition: border 0.3s ease;
}
.blobbi-gradient-container:hover {
  border-color: rgba(233, 213, 255, 0.8);
}

/* Exemplo de uso em texto com ícones */
.blobbi-stat-label {
  color: #4B5563; /* gray-600 */
}
.blobbi-stat-value {
  color: #111827; /* gray-900 */
  font-weight: 500;
}
```

Esses estilos são aplicados especialmente no modo claro para reforçar contraste, suavidade e manter a estética "gelatinosa e leve".


---

## ☀️ Light Mode – Card com Destaque Expandido

```css
.blobbi-card-xl {
  background-color: rgba(255, 255, 255, 0.9);         /* bg-white/90 */
  border: 1px solid rgba(233, 213, 255, 0.6);         /* border-purple-200/60 */
  border-radius: 1rem;                                /* rounded-2xl */
  backdrop-filter: blur(4px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);          /* shadow-sm */
  transition: all 0.3s ease;
}
.blobbi-card-xl:hover {
  transform: scale(1.02);
  box-shadow: 0 24px 36px rgba(233, 213, 255, 0.2);   /* hover:shadow-purple-200/20 */
  border-color: rgba(233, 213, 255, 0.8);
}

/* Badge personalizada lilás */
.blobbi-badge-baby {
  background: rgba(243, 232, 255, 0.5); /* bg-purple-50/50 */
  color: #7E22CE;
  border: 1px solid #E9D5FF;
  font-size: 0.75rem;
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  font-weight: 600;
}

/* Gradiente do personagem dentro do card */
.blobbi-gradient-frame {
  background-image: linear-gradient(to bottom right, rgba(243,232,255,0.8), rgba(252,231,243,0.8));
  border: 2px solid rgba(233, 213, 255, 0.6);
  border-radius: 1rem;
  transition: border 0.3s ease;
}
.blobbi-gradient-frame:hover {
  border-color: rgba(233, 213, 255, 0.8);
}

/* Indicadores de status */
.blobbi-status-icon-yellow { color: #F59E0B; }
.blobbi-status-icon-blue   { color: #3B82F6; }
.blobbi-status-icon-purple { color: #8B5CF6; }
.blobbi-status-icon-red    { color: #EF4444; }

/* Botões com hover suave */
.blobbi-button {
  border: 1px solid #E9D5FF;
  color: #7E22CE;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 500;
  font-size: 0.875rem;
  background-color: transparent;
  transition: background-color 0.2s ease;
}
.blobbi-button:hover {
  background-color: rgba(243, 232, 255, 0.4); /* hover:bg-purple-50 */
}
```
