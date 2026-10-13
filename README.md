# PulseFit Gym Management

A polished, responsive gym-management SaaS experience inspired by premium performance brands. It includes a conversion-focused landing page, role selection, and dedicated admin, trainer, and member workspaces.

## Included

- Responsive marketing site with feature, process, pricing, testimonial, and CTA sections
- Generated original fitness campaign artwork in `public/hero-trainer.png`
- Role-based demo sign-in for administrators, trainers, and members
- Admin analytics with revenue, attendance, member, and membership views
- Trainer workspace for members, workouts, nutrition, and progress
- Member workspace with membership status, today's workout, coach, habit, and progress views
- Responsive navigation, tables, filters, charts, and mobile sidebar

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. On the sign-in page, choose any role; the demo credentials are pre-filled.

## Production build

```bash
npm run build
npm run preview
```

The production bundle is written to `dist/`.

## Project structure

```text
public/             Generated campaign artwork
src/pages/          Landing, authentication, and app workspaces
src/data.js         Realistic interface seed data
src/styles.css      Responsive visual system
src/App.jsx         Role-aware routing
```

## Next production integration

The current deliverable is the complete interactive frontend experience. For live operations, connect the forms and dashboards to an Express/MongoDB API, replace demo role navigation with JWT-backed sessions, and add persistent payment, attendance, plan, and notification services.
