import sys, glob, os
from PIL import Image, ImageDraw
src, out, cols, scale = sys.argv[1], sys.argv[2], int(sys.argv[3]), float(sys.argv[4])
files = sorted(glob.glob(src + '/*.png'))
ims = [Image.open(f) for f in files]
w, h = int(ims[0].width*scale), int(ims[0].height*scale)
rows = (len(ims)+cols-1)//cols
sheet = Image.new('RGB', (cols*w, rows*(h+16)), (20,20,20))
d = ImageDraw.Draw(sheet)
for i,(f,im) in enumerate(zip(files, ims)):
    x, y = (i%cols)*w, (i//cols)*(h+16)
    sheet.paste(im.resize((w,h)), (x,y))
    d.text((x+4, y+h+2), os.path.basename(f), fill=(255,255,255))
sheet.save(out)
