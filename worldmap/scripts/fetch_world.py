"""下载世界底图的原始数据（只需运行一次；输出在 worldmap/data/raw/，不入库）。

  data/raw/dem/{z}/{x}/{y}.png   Terrarium 高程瓦片（AWS Open Data "Terrain Tiles"）：全球 z4，印度洋—东亚 z5
  data/raw/ne_50m_land.geojson                 Natural Earth 1:50m 陆地
  data/raw/ne_50m_lakes.geojson                Natural Earth 1:50m 湖泊
  data/raw/ne_10m_rivers_lake_centerlines.geojson   Natural Earth 1:10m 河流

用法：python3 -I worldmap/scripts/fetch_world.py
已存在的文件不会重复下载。
"""
import math, os, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'raw')
UA = {'User-Agent': 'zheng-he-voyages-worldmap/1.0 (historical map)'}
NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/'

# 细图范围，须与 build_world.py 中的 DETAIL 一致（经度西、纬度南、经度东、纬度北）
DETAIL = (20.0, -20.0, 150.0, 55.0)


def get(url, tries=6):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
                body = r.read()
            if body:
                return body
        except Exception as e:
            print('  retry', i + 1, url[-60:], e, file=sys.stderr)
        time.sleep(3 * (i + 1))
    raise SystemExit('failed: ' + url)


def tile_range(box, z):
    w, s, e, n = box
    n2 = 2 ** z
    tx = lambda lon: min(n2 - 1, int((lon + 180) / 360 * n2))
    ty = lambda lat: min(n2 - 1, int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n2))
    return range(tx(w), tx(e) + 1), range(ty(n), ty(s) + 1)


def fetch_dem(box, z):
    xs, ys = tile_range(box, z)
    got = 0
    for x in xs:
        for y in ys:
            p = os.path.join(RAW, 'dem', str(z), str(x), f'{y}.png')
            if os.path.exists(p):
                continue
            os.makedirs(os.path.dirname(p), exist_ok=True)
            with open(p, 'wb') as f:
                f.write(get(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'))
            got += 1
    print(f'dem z{z}: {len(xs) * len(ys)} tiles ({got} new)')


def fetch_ne(name):
    p = os.path.join(RAW, name + '.geojson')
    if os.path.exists(p):
        return
    body = get(NE + name + '.geojson')
    with open(p, 'wb') as f:
        f.write(body)
    print('saved', name, len(body) // 1024, 'KB')


def main():
    os.makedirs(RAW, exist_ok=True)
    fetch_dem((-180, -85, 180, 85), 4)
    fetch_dem(DETAIL, 5)
    for n in ('ne_50m_land', 'ne_50m_lakes', 'ne_10m_rivers_lake_centerlines'):
        fetch_ne(n)


if __name__ == '__main__':
    main()
