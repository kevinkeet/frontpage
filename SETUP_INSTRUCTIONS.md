# Visual Resume - Google Sheets Setup

## Quick Start

### Step 1: Create Your Google Sheet

Create a new Google Sheet with these exact column headers in Row 1:

| id | position | icon | title | intro | bullets | tags | isDog |
|----|----------|------|-------|-------|---------|------|-------|

### Step 2: Fill In Your Content

Each row is one hotspot on the image. Here's what each column means:

| Column | Description | Example |
|--------|-------------|---------|
| **id** | Unique identifier (no spaces) | `diplomas`, `family`, `laptop` |
| **position** | Location on image: `left,top,width,height` (percentages) | `1,2,28,32` |
| **icon** | FontAwesome icon name | `fa-graduation-cap`, `fa-heart`, `fa-dog` |
| **title** | Card title | `Education & Credentials` |
| **intro** | Optional intro text before bullets | `Places I've explored:` |
| **bullets** | Bullet points separated by semicolons | `Item 1; Item 2; Item 3` |
| **tags** | Tags separated by semicolons (add * for amber color) | `Stanford; Teaching*` |
| **isDog** | Set to `true` only for the dog chat hotspot | `true` or `false` |

### Step 3: Publish Your Sheet

1. Go to **File → Share → Publish to web**
2. Under "Link", select **Sheet1** (or your sheet name)
3. Change the format to **Comma-separated values (.csv)**
4. Click **Publish**
5. Copy the URL that appears

### Step 4: Add URL to Your Website

Open `index.html` and find this line near the top of the `<script>` section:

```javascript
const GOOGLE_SHEET_CSV_URL = '';
```

Paste your published URL between the quotes:

```javascript
const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX.../pub?output=csv';
```

---

## Sample Data

Here's the default content as a reference:

```
id,position,icon,title,intro,bullets,tags,isDog
diplomas,"1,2,28,32",fa-graduation-cap,Education & Credentials,,"MD, University of Vermont (2007); Internal Medicine Residency, UCSF (2007-2010); BA, UC San Diego (2002)",Board Certified; UCSF Trained,false
family,"1,36,10,26",fa-heart,Family,,"Wife owns ""Ethos"" in Santa Cruz; Daughter (17) – University of Oregon; Daughter (15) – Water Polo player",Santa Cruz; Proud Dad*,false
map,"12,33,9,20",fa-globe-americas,Travel,Places I've explored:,"Spain, Greece, New Zealand; Australia, Bali, Singapore",Adventure; Exploration,false
reading,"0,56,15,26",fa-newspaper,Reading & Interests,,Asterix comics; Astral Codex Ten (blog); AI/ML research papers,Curious Mind,false
laptop,"21,40,16,26",fa-laptop-code,Current Focus,,"Co-Director: AI for Medicine Residents Curriculum (2024-); Researching GPT-4 vs authentic residency statements; Building AI literacy programs",AI in Medicine; Education,false
awards,"52,38,22,15",fa-trophy,Awards & Recognition,,"Stanford Teaching Award (2024); Medical Educator Award – VA (2015)",Excellence*; Teaching,false
bookshelf,"52,54,22,20",fa-book,Bookshelf,Favorite reads:,"Project Hail Mary; Cloud Atlas; Medical journals & AI research",Sci-Fi Fan; Lifelong Learner,false
calendar,"77,40,11,20",fa-calendar-alt,Schedule & Events,,Upcoming: IHME Presentation; Teaching sessions weekly; AI curriculum development,Speaker,false
surfboard,"87,18,7,74",fa-water,Hobbies,,"Surfing – Santa Cruz breaks; Basketball; Outdoor adventures",Active Lifestyle*,false
whitecoat,"94,4,6,38",fa-stethoscope,Clinical Practice,,"Hospitalist, Stanford Medicine (2021-); Hospitalist, Palo Alto VA (2010-); Associate Program Director",Stanford; VA Healthcare,false
dog,"54,68,18,26",fa-dog,Frankenstein,Kevin's loyal Bloodhound companion. Click to chat with me and ask questions about Kevin!,,AI Assistant*; Click to Chat!*,true
```

---

## Tips

### Finding Icon Names
Browse icons at: https://fontawesome.com/icons?d=gallery&m=free
Use format: `fa-icon-name` (e.g., `fa-briefcase`, `fa-code`, `fa-music`)

### Positioning Hotspots
- `position` is: `left%, top%, width%, height%`
- Values are percentages of the image
- Use browser dev tools to help find coordinates
- Tip: Start with approximate values and adjust

### Tag Colors
- Regular tags: teal color (default)
- Add `*` at end for amber/gold color: `Excellence*`

### Content Updates
Changes to your Google Sheet appear automatically on page refresh!
(Note: Google may cache for up to 5 minutes)

---

## Troubleshooting

**Content not updating?**
- Make sure the sheet is published (not just shared)
- Check browser console for errors
- Try clearing browser cache

**Hotspots in wrong position?**
- Adjust the `position` values in your sheet
- Format: `left,top,width,height` (all percentages)

**Sheet URL not working?**
- Make sure you selected "CSV" format when publishing
- URL should contain `pub?output=csv`
