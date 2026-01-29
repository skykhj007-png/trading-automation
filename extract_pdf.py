import pdfplumber

pdf_path = r'C:\Users\k\Documents\카카오톡 받은 파일\코인초보자료.pdf'

with pdfplumber.open(pdf_path) as pdf:
    with open('coin_guide.txt', 'w', encoding='utf-8') as f:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ''
            f.write(f'=== Page {i+1} ===\n{text}\n\n')
            
print('Done!')