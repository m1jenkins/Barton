import os
import re

files_to_update = [
    "index.html", "arlington.html", "austin.html", "dallas.html", 
    "el-paso.html", "fort-worth.html", "houston.html", "new-braunfels.html", 
    "san-antonio.html", "san-marcos.html"
]

new_content = """        <div class="why-promo__inner">
            <h2 class="why-promo__title">THE TRUE COST OF DOING IT YOURSELF</h2>
            <div class="why-promo__grid">
                <div class="why-promo__col">
                    <div class="why-promo__icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    </div>
                    <h3 class="why-promo__col-title">Time Down the Drain</h3>
                    <p class="why-promo__col-desc">Hours spent scrolling endless listings, deciphering confusing car jargon, and agonizing over the "right" choice.</p>
                </div>
                <div class="why-promo__col">
                    <div class="why-promo__icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                    </div>
                    <h3 class="why-promo__col-title">Exhausting Dealership Games</h3>
                    <p class="why-promo__col-desc">The intense stress of negotiating, dodging hidden fees, and the constant fear of being taken advantage of.</p>
                </div>
                <div class="why-promo__col">
                    <div class="why-promo__icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                    </div>
                    <h3 class="why-promo__col-title">Leaving Money on the Table</h3>
                    <p class="why-promo__col-desc">Without an expert negotiator on your side, you risk overpaying by thousands.</p>
                </div>
            </div>
            <p class="why-promo__closing">Don't guarantee yourself a stressful ordeal. Let Drive Right handle the headaches so you can just enjoy the thrill of your new ride.</p>
        </div>"""

pattern = re.compile(r'<div class="why-promo__inner">.*?</div>\s*</section>', re.DOTALL)

for file_name in files_to_update:
    if not os.path.exists(file_name):
        print(f"Skipping {file_name}, does not exist.")
        continue
        
    with open(file_name, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Replace the inner div and up to </section>
    new_full_content = new_content + "\n    </section>"
    updated_content = pattern.sub(new_full_content, content)
    
    with open(file_name, 'w', encoding='utf-8') as f:
        f.write(updated_content)
    print(f"Updated {file_name}")

