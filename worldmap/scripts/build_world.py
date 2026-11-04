"""由 fetch_world.py 下载的原始数据生成世界底图（docs/SPEC.md §2）。

输出（都入库，页面不需要原始数据即可运行）：
  worldmap/assets/terrain_world.jpg   全球地形晕渲 + 分层设色，1 像素 = 1 u（0.1° 纬度）
  worldmap/assets/terrain_io.jpg      印度洋—东亚细图，1 像素 = 0.4 u
  worldmap/geo/world.geo.js           陆地、湖泊、河流（中文名）、山脉与海洋注记，世界坐标

投影：等距圆柱，标准纬线 ±30°。x = (经度 + 180) × K × C，y = (90 − 纬度) × K，K = 10，C = cos 30°。
陆地轮廓以 Natural Earth 1:50m 为准，栅格与矢量用同一套多边形，两者严格对齐。
配色沿用 songjin-zhizhan/scripts/build_geodata.py 的陆地色阶。

用法：python3 -I worldmap/scripts/build_world.py   （需要 numpy、scipy、Pillow）
"""
import json, math, os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'raw')
OUT_IMG = os.path.join(ROOT, 'assets')
OUT_JS = os.path.join(ROOT, 'geo', 'world.geo.js')

K = 10.0
C = math.cos(math.radians(30))
W_U, H_U = 360 * K * C, 180 * K
RASTERS = {
    'world': {'box': (-180.0, -90.0, 180.0, 90.0), 'px': 1.0, 'z': 4, 'exag': 22.0, 'minScale': 0},
    'io': {'box': (20.0, -20.0, 150.0, 55.0), 'px': 0.4, 'z': 5, 'exag': 14.0, 'minScale': 0.9},
}


def proj(lon, lat):
    return (lon + 180.0) * K * C, (90.0 - lat) * K


# ---------------------------------------------------------------- 高程
def mosaic(z):
    d = os.path.join(RAW, 'dem', str(z))
    xs = sorted(int(x) for x in os.listdir(d))
    ys = sorted({int(f[:-4]) for x in xs for f in os.listdir(os.path.join(d, str(x)))})
    m = np.full((len(ys) * 256, len(xs) * 256), np.nan, np.float32)
    for i, x in enumerate(xs):
        for j, y in enumerate(ys):
            p = os.path.join(d, str(x), f'{y}.png')
            if os.path.exists(p):
                a = np.asarray(Image.open(p).convert('RGB'), np.float32)
                m[j * 256:(j + 1) * 256, i * 256:(i + 1) * 256] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
    return m, xs[0], ys[0], z


def sample(M, lon, lat):
    m, x0, y0, z = M
    n = 2 ** z * 256
    lat = np.clip(lat, -85.0, 85.0)
    px = (lon + 180) / 360 * n - x0 * 256 - .5
    py = (1 - np.arcsinh(np.tan(np.radians(lat))) / math.pi) / 2 * n - y0 * 256 - .5
    return ndimage.map_coordinates(np.nan_to_num(m, nan=0), [py, px], order=1, mode='nearest')


# ---------------------------------------------------------------- 着色
def hexc(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


LAND = [(-1, '#dde3c4'), (0, '#dde3c4'), (20, '#e1e4c3'), (60, '#e8e4bf'), (120, '#e9dcb0'), (220, '#dfc897'), (380, '#d2b482'),
        (600, '#c09d6d'), (900, '#a9875c'), (1400, '#977a58'), (2500, '#8a7660'), (4500, '#9a8f84'), (6000, '#b4aca2')]
SEA = [(-8000, '#93adac'), (-5000, '#9ab4b3'), (-3000, '#a3bcba'), (-1000, '#b3cac6'), (-200, '#c3d6d0'), (-40, '#cddcd5'), (0, '#d3dfd8')]
LAKE = np.array(hexc('#c5d8d3'), np.float32)


def tint(e, stops):
    lv = np.array([s[0] for s in stops], np.float32)
    col = np.array([hexc(s[1]) for s in stops], np.float32)
    out = np.empty(e.shape + (3,), np.float32)
    for c in range(3):
        out[..., c] = np.interp(e, lv, col[:, c])
    return out


def hillshade(e, dx, dy, exag, az=315, alt=42):
    gy = np.gradient(e * exag, axis=0) / dy
    gx = np.gradient(e * exag, axis=1) / dx[:, None]
    slope = np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    a, z = math.radians(360 - az + 90), math.radians(90 - alt)
    return np.clip(np.cos(z) * np.cos(slope) + np.sin(z) * np.sin(slope) * np.cos(a - aspect), 0, 1)


# ---------------------------------------------------------------- 矢量读取
def polys_of(feature):
    g = feature['geometry']
    if g is None:
        return []
    return [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']


def lines_of(feature):
    g = feature['geometry']
    if g is None:
        return []
    return [g['coordinates']] if g['type'] == 'LineString' else g['coordinates']


def rasterize(polys, box, px, w, h, ss=3):
    """多边形 → 抗锯齿覆盖率（0—1）。polys：[[外环, 洞…], …]，坐标为经纬度。"""
    x0, y0 = proj(box[0], box[3])
    img = Image.new('L', (w * ss, h * ss), 0)
    dr = ImageDraw.Draw(img)
    f = lambda ring: [((proj(lo, la)[0] - x0) / px * ss, (proj(lo, la)[1] - y0) / px * ss) for lo, la in ring]
    for poly in polys:
        if len(poly[0]) >= 3:
            dr.polygon(f(poly[0]), fill=255)
        for hole in poly[1:]:
            if len(hole) >= 3:
                dr.polygon(f(hole), fill=0)
    img = img.resize((w, h), Image.BOX)
    return np.asarray(img, np.float32) / 255


def render(name, land_polys, lake_polys):
    R = RASTERS[name]
    box, px = R['box'], R['px']
    x0, y0 = proj(box[0], box[3])
    x1, y1 = proj(box[2], box[1])
    w, h = int(round((x1 - x0) / px)), int(round((y1 - y0) / px))
    xs = x0 + (np.arange(w) + .5) * px
    ys = y0 + (np.arange(h) + .5) * px
    lon = xs / (K * C) - 180
    lat = 90 - ys / K
    Lon, Lat = np.meshgrid(lon, lat)
    M = mosaic(R['z'])
    e = sample(M, Lon, Lat).astype(np.float32)
    # 高程瓦片只到 ±85°，再往极地是拉伸的同一行，会出现竖条纹：按纬度逐行加大横向平滑
    for j in np.flatnonzero(np.abs(lat) > 80):
        k = int(min(400, (abs(lat[j]) - 80) * 40 / px)) | 1
        e[j] = ndimage.uniform_filter1d(e[j], k, mode='wrap')
    e = ndimage.gaussian_filter(e, .6)
    a = rasterize(land_polys, box, px, w, h)
    lake = rasterize(lake_polys, box, px, w, h)
    land = a > .5
    # 陆地上的低洼（里海沿岸、死海等）与海中的高程误差：分别夹到陆上/海下
    eL = np.where(land, np.maximum(e, 1.0), np.minimum(e, -5.0))
    dy = px / K * 111320.0
    dx = px / (K * C) * 111320.0 * np.maximum(np.cos(np.radians(lat)), .05)
    hs = .72 * hillshade(eL, dx, dy, R['exag']) + .28 * hillshade(eL, dx, dy, R['exag'], az=0, alt=55)
    flat = .72 * math.cos(math.radians(48)) + .28 * math.cos(math.radians(35))
    shade = np.clip(1 + (hs - flat) * 1.25, .45, 1.25)
    land_rgb = tint(np.maximum(eL, 0), LAND) * shade[..., None]
    sea_shade = np.clip(1 + (hs - flat) * .2, .9, 1.06)
    sea_rgb = tint(np.minimum(eL, 0), SEA) * sea_shade[..., None]
    rgb = land_rgb * a[..., None] + sea_rgb * (1 - a[..., None])
    rgb = rgb * (1 - lake[..., None]) + LAKE * lake[..., None]
    img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))
    fn = f'terrain_{name}.jpg'
    img.save(os.path.join(OUT_IMG, fn), quality=80, optimize=True, progressive=True)
    print(fn, w, 'x', h, os.path.getsize(os.path.join(OUT_IMG, fn)) // 1024, 'KB')
    return {'id': name, 'src': 'assets/' + fn, 'box': [round(x0, 2), round(y0, 2), round(w * px, 2), round(h * px, 2)], 'minScale': R['minScale']}


# ---------------------------------------------------------------- 路径
def dp(pts, tol):
    if len(pts) < 3:
        return pts
    P = np.asarray(pts, float)
    keep = np.zeros(len(P), bool)
    keep[0] = keep[-1] = True
    stack = [(0, len(P) - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        d = P[j] - P[i]
        L = math.hypot(*d)
        seg = P[i + 1:j] - P[i]
        dist = np.hypot(seg[:, 0], seg[:, 1]) if L == 0 else np.abs(seg[:, 0] * d[1] - seg[:, 1] * d[0]) / L
        k = int(np.argmax(dist))
        if dist[k] > tol:
            keep[i + 1 + k] = True
            stack += [(i, i + 1 + k), (i + 1 + k, j)]
    return P[keep].tolist()


def area(pts):
    P = np.asarray(pts)
    return abs(np.dot(P[:, 0], np.roll(P[:, 1], 1)) - np.dot(P[:, 1], np.roll(P[:, 0], 1))) / 2


def path_d(lines, closed=False):
    out = []
    for ln in lines:
        if len(ln) < 2:
            continue
        q = [(round(x * 10), round(y * 10)) for x, y in ln]      # 0.1 u 精度，用整数差分避免累积误差
        s = 'M' + fmt(q[0][0]) + ',' + fmt(q[0][1])
        for a, b in zip(q, q[1:]):
            dx, dy = b[0] - a[0], b[1] - a[1]
            if dx or dy:
                s += 'l' + fmt(dx) + ',' + fmt(dy)
        out.append(s + ('z' if closed else ''))
    return ''.join(out)


def fmt(v):
    s = f'{v / 10:.1f}'.rstrip('0').rstrip('.')
    return '0' if s == '-0' else s


def project_ring(ring):
    return [proj(lo, la) for lo, la in ring]


# ---------------------------------------------------------------- 名称
RIVER_ZH = {
    'Yangtze': '长江', 'Chang Jiang': '长江', 'Jinsha': '金沙江', 'Huang': '黄河', 'Yellow': '黄河', 'Amur': '黑龙江', 'Songhua': '松花江',
    'Nen': '嫩江', 'Ussuri': '乌苏里江', 'Liao': '辽河', 'Yalu': '鸭绿江', 'Tumen': '图们江', 'Huai': '淮河', 'Wei': '渭河', 'Fen': '汾河',
    'Han': '汉水', 'Songhua Jiang': '松花江', 'Songhua': '松花江', 'Sungari': '松花江', 'Di’er Songhua': '松花江', 'Jinsha Jiang': '金沙江', 'Yarlung Zangbo': '雅鲁藏布江', 'Jialing': '嘉陵江', 'Min': '岷江', 'Xiang': '湘江', 'Gan': '赣江', 'Yuan': '沅江', 'Xi': '西江', 'Pearl': '珠江',
    'Luan': '滦河', 'Hai': '海河', 'Tarim': '塔里木河', 'Mekong': '湄公河', 'Red': '红河', 'Hong': '红河', 'Chao Phraya': '湄南河',
    'Salween': '萨尔温江', 'Nu': '怒江', 'Irrawaddy': '伊洛瓦底江', 'Brahmaputra': '布拉马普特拉河', 'Yarlung': '雅鲁藏布江', 'Dihang': '布拉马普特拉河',
    'Ganges': '恒河', 'Yamuna': '朱木拿河', 'Indus': '印度河', 'Sutlej': '萨特莱杰河', 'Chenab': '杰纳布河', 'Jhelum': '杰赫勒姆河',
    'Narmada': '讷尔默达河', 'Krishna': '克里希纳河', 'Cauvery': '高韦里河', 'Helmand': '赫尔曼德河', 'Kura': '库拉河',
    'Ob': '鄂毕河', 'Irtysh': '额尔齐斯河', 'Ertis': '额尔齐斯河', 'Yenisey': '叶尼塞河', 'Lena': '勒拿河', 'Selenga': '色楞格河',
    'Volga': '伏尔加河', 'Ural': '乌拉尔河', 'Don': '顿河', 'Dnieper': '第聂伯河', 'Danube': '多瑙河', 'Rhine': '莱茵河', 'Rhein': '莱茵河',
    'Elbe': '易北河', 'Vistula': '维斯瓦河', 'Rhône': '罗讷河', 'Loire': '卢瓦尔河', 'Seine': '塞纳河', 'Po': '波河', 'Ebro': '埃布罗河',
    'Tagus': '塔霍河', 'Tajo': '塔霍河', 'Tejo': '塔霍河', 'Tigris': '底格里斯河', 'Dicle': '底格里斯河', 'Euphrates': '幼发拉底河',
    'Firat': '幼发拉底河', 'Al Furat': '幼发拉底河', 'Shatt al Arab': '阿拉伯河', 'Nile': '尼罗河', 'White Nile': '白尼罗河',
    'Blue Nile': '青尼罗河', 'Abay': '青尼罗河', 'Niger': '尼日尔河', 'Congo': '刚果河', 'Lualaba': '刚果河', 'Zambezi': '赞比西河',
    'Limpopo': '林波波河', 'Orange': '奥兰治河', 'Jubba': '朱巴河', 'Shabeelle': '谢贝利河', 'Shebele': '谢贝利河',
    'Mississippi': '密西西比河', 'Missouri': '密苏里河', 'Ohio': '俄亥俄河', 'St. Lawrence': '圣劳伦斯河', 'Mackenzie': '马更些河',
    'Yukon': '育空河', 'Colorado': '科罗拉多河', 'Rio Grande': '格兰德河', 'Amazonas': '亚马孙河', 'Paraná': '巴拉那河',
    'Orinoco': '奥里诺科河', 'Murray': '墨累河', 'Darling': '达令河'
}
BIG_RIVERS = {'长江', '黄河', '尼罗河', '恒河', '印度河', '幼发拉底河', '底格里斯河', '伏尔加河', '多瑙河', '湄公河', '亚马孙河', '密西西比河',
              '刚果河', '尼日尔河', '黑龙江', '鄂毕河', '叶尼塞河', '勒拿河', '伊洛瓦底江', '布拉马普特拉河'}

# 地形注记：[名称, 经度, 纬度, 旋转角度, 级别（1 全图可见，2 中等缩放，3 放大后）]
RANGES = [
    ['喜马拉雅山脉', 84.5, 28.6, -14, 1], ['昆仑山', 85.5, 36.0, -4, 2], ['天山', 81.0, 42.3, -6, 2], ['阿尔泰山', 90.0, 47.8, -28, 2],
    ['青藏高原', 88.5, 32.8, 0, 1], ['帕米尔', 73.6, 38.4, 0, 3], ['兴都库什山', 69.5, 35.6, -18, 2], ['祁连山', 98.5, 38.6, -20, 3],
    ['秦岭', 108.2, 33.8, -4, 3], ['太行山', 113.6, 37.2, -80, 3], ['大兴安岭', 121.0, 46.5, -60, 3], ['横断山', 99.5, 28.5, -80, 3],
    ['蒙古高原', 105.0, 45.0, 0, 2], ['戈壁', 103.0, 42.6, 0, 3], ['塔克拉玛干沙漠', 83.0, 38.9, 0, 3],
    ['德干高原', 77.0, 17.5, 0, 2], ['西高止山', 74.6, 14.0, -75, 3], ['伊朗高原', 57.0, 32.0, 0, 2], ['扎格罗斯山', 48.0, 32.5, -42, 3],
    ['高加索山', 44.0, 42.8, -16, 3], ['阿拉伯沙漠', 46.0, 22.5, 0, 2], ['安纳托利亚高原', 33.5, 39.0, 0, 3],
    ['撒哈拉沙漠', 10.0, 23.0, 0, 1], ['埃塞俄比亚高原', 39.0, 9.5, 0, 2], ['阿特拉斯山', -3.0, 32.0, -18, 3], ['卡拉哈里沙漠', 22.5, -23.0, 0, 3],
    ['乌拉尔山', 59.5, 58.0, -84, 2], ['阿尔卑斯山', 10.0, 46.6, -8, 3], ['比利牛斯山', 0.5, 42.7, -8, 3],
    ['落基山脉', -112.0, 45.0, -64, 1], ['阿巴拉契亚山', -80.0, 38.0, -48, 3], ['安第斯山脉', -70.0, -20.0, -84, 1],
    ['澳大利亚大沙漠', 128.0, -25.0, 0, 2]
]
# 海洋注记：[名称, 经度, 纬度, 级别]
SEAS = [
    ['太平洋', -150.0, 15.0, 1], ['太平洋', 165.0, 25.0, 1], ['印度洋', 78.0, -15.0, 1], ['大西洋', -35.0, 25.0, 1], ['大西洋', -20.0, -25.0, 1],
    ['北冰洋', 30.0, 80.0, 1], ['南大洋', 60.0, -60.0, 1],
    ['南海', 114.5, 14.5, 2], ['东海', 125.6, 29.0, 2], ['黄海', 123.8, 35.6, 3], ['日本海', 135.0, 40.5, 2], ['鄂霍次克海', 148.0, 54.0, 2],
    ['菲律宾海', 132.0, 18.0, 2], ['爪哇海', 111.5, -5.0, 3], ['阿拉伯海', 64.5, 15.5, 2], ['孟加拉湾', 88.5, 14.5, 2],
    ['安达曼海', 96.4, 10.0, 3], ['红海', 38.3, 19.6, 3], ['波斯湾', 51.0, 27.4, 3], ['亚丁湾', 48.0, 12.2, 3], ['地中海', 18.0, 34.5, 2],
    ['黑海', 34.5, 43.3, 3], ['里海', 50.8, 41.8, 3], ['波罗的海', 19.5, 57.5, 3], ['北海', 3.5, 56.0, 3], ['墨西哥湾', -90.0, 25.0, 2],
    ['加勒比海', -75.0, 15.0, 2], ['珊瑚海', 155.0, -16.0, 3], ['塔斯曼海', 160.0, -40.0, 3], ['莫桑比克海峡', 41.5, -18.5, 3]
]


def main():
    os.makedirs(OUT_IMG, exist_ok=True)
    os.makedirs(os.path.dirname(OUT_JS), exist_ok=True)
    land_f = json.load(open(os.path.join(RAW, 'ne_50m_land.geojson')))['features']
    lake_f = json.load(open(os.path.join(RAW, 'ne_50m_lakes.geojson')))['features']
    land_polys = [p for f in land_f for p in polys_of(f)]
    lake_polys = [p for f in lake_f for p in polys_of(f)]

    rasters = [render(n, land_polys, lake_polys) for n in RASTERS]

    # 陆地：外环与洞都输出；面积小于 0.3 u²（约 3 平方公里量级的小岛）略去
    land_rings = []
    for poly in land_polys:
        for k, ring in enumerate(poly):
            pr = dp(project_ring(ring), .1)
            if len(pr) >= 4 and area(pr) >= .3:
                land_rings.append(pr)
    lake_rings = []
    for poly in lake_polys:
        for ring in poly[:1]:
            pr = dp(project_ring(ring), .15)
            if len(pr) >= 4 and area(pr) >= 1.5:
                lake_rings.append(pr)

    rivers = {}
    for f in json.load(open(os.path.join(RAW, 'ne_10m_rivers_lake_centerlines.geojson')))['features']:
        p = f['properties']
        en = p.get('name_en') or p.get('name')
        zh = RIVER_ZH.get(p.get('name') or '') or RIVER_ZH.get(en)      # 先看本地名：金沙江、雅鲁藏布江在 name_en 中记作长江、布拉马普特拉河
        if not zh:
            for alt in (p.get('name') or '', p.get('name_alt') or '', en or ''):
                base = alt.replace(' Jiang', '').replace(' He', '').replace(' Zangbo', '').strip()
                if base in RIVER_ZH:
                    zh = RIVER_ZH[base]
                    break
        if not zh:
            continue
        for ln in lines_of(f):
            if zh == '汉水' and ln[0][0] > 120:       # 韩国的汉江
                continue
            if zh == '红河' and ln[0][0] < 90:        # 其他同名河流
                continue
            pts = dp(project_ring(ln), .2)
            if len(pts) >= 2:
                rivers.setdefault(zh, {'en': en, 'parts': []})['parts'].append(pts)
    river_out = []
    for zh, r in rivers.items():
        parts = r['parts']
        lens = [sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(p, p[1:])) for p in parts]
        main = parts[int(np.argmax(lens))]
        if main[0][1] < main[-1][1] and False:
            main = main[::-1]
        river_out.append({'n': zh, 'en': r['en'], 'w': 2 if zh in BIG_RIVERS else 1, 'd': path_d(parts), 'ld': path_d([main]), 'len': round(max(lens))})
    river_out.sort(key=lambda r: -r['len'])

    geo = {
        'proj': {'K': K, 'C': round(C, 7), 'phi0': 30, 'size': [round(W_U, 2), H_U]},
        'rasters': rasters,
        'land': path_d(land_rings, True),
        'lakes': path_d(lake_rings, True),
        'rivers': river_out,
        'ranges': [{'n': n, 'at': [lo, la], 'rot': r, 'rank': k} for n, lo, la, r, k in RANGES],
        'seas': [{'n': n, 'at': [lo, la], 'rank': k} for n, lo, la, k in SEAS],
    }
    js = ('/* 世界底图矢量（世界坐标，见 docs/SPEC.md §2）。由 worldmap/scripts/build_world.py 生成，勿手改。\n'
          ' * 数据：Natural Earth 1:50m 陆地与湖泊、1:10m 河流（公有领域）。 */\n'
          'window.WM_GEO=' + json.dumps(geo, ensure_ascii=False, separators=(',', ':')) + ';\n')
    open(OUT_JS, 'w', encoding='utf8').write(js)
    print('world.geo.js', len(js.encode('utf8')) // 1024, 'KB; land rings', len(land_rings), 'lakes', len(lake_rings), 'rivers', len(river_out))
    print('missing rivers:', sorted(set(RIVER_ZH.values()) - set(rivers)))


if __name__ == '__main__':
    main()
