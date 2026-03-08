Greg's Cafe, Chembur (Demo Website)

What this demo is
- A premium, mobile-first, static website concept for a cafe in Chembur.
- Built for portfolio and sales presentations for cafe and restaurant clients.

How to deploy on GitHub Pages
1. Create a GitHub repository and upload the entire Greg's Cafe demo folder.
2. In the repository settings, open Pages.
3. Select the main branch and the root folder, then save.
4. Your site will be live at a GitHub Pages URL after a few minutes.

Local viewing note
- Because the menu loads via fetch, open the site using a local server.
- Use VS Code Live Server or any simple HTTP server to preview.

How to change the WhatsApp number
- Update "whatsappNumber" in data/menu.json.

How to edit menu categories/items
- Open data/menu.json and edit the categories or items.
- Each item must include id, name, desc, price, veg, available.
- Add addonGroupIds if the item supports add-ons.

How to replace images
- Replace the files in images/ with your own images.
- Keep the same file names or update the image paths in HTML and data/menu.json.

How to update offers or add-ons
- Update "todayOffer" and "addonGroups" in data/menu.json.

HTTPS note
- Enable SSL/HTTPS from your hosting provider (GitHub Pages/Cloudflare/etc.).
