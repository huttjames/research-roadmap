# IfDT Research Roadmap

Interactive research roadmap prototype built with React, Vite, SheetJS, and D3 hierarchy.

The app loads a published Google Sheets CSV, groups rows into:

`Central roadmap node -> Major Category -> Subcategory -> Question`

Question leaves are clickable and open a detail card with the selected row's research context, why it matters, how to solve it, sub-questions, best resources, and last updated date.

## Local Development

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Data

The default data source is this published Google Sheets CSV:

<https://docs.google.com/spreadsheets/d/e/2PACX-1vSqLA1y00VMLkhP8oWfYT9WqQp9GqlFCOKXUYnkD051OEq9rLXWWXBvSJe8XeZsUqYR9vhTMZU9VtsR/pub?gid=0&single=true&output=csv>

The app expects one research question per row. It recognizes these columns, including small spelling/case/spacing variations:

- Major Category
- Subcategory
- Question Title
- Context
- Why It Matters
- How To Solve
- Sub-questions
- Best Resources
- Last Updated

Rows without a question title are ignored. Major categories and subcategories are generated from the CSV data rather than hard-coded.

Users can also upload a replacement `.csv`, `.xlsx`, or `.xls` file in the browser. Uploaded files are parsed locally in the browser and are not sent to a server.

## Deploy To Vercel

1. Push this folder to a GitHub repository.
2. In Vercel, choose **Add New Project**.
3. Import the GitHub repository.
4. Use Vercel's detected Vite settings:
   - Build command: `npm run build`
   - Output directory: `dist`
   - Install command: `npm install`
5. Deploy.

After deployment, Vercel will provide a normal public URL that can be shared with teammates.

## Deploy To Netlify

1. Push this folder to GitHub.
2. Create a new Netlify site from the GitHub repository.
3. Use:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Deploy.
