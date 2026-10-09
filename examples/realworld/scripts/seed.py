"""Fills a running RealWorld API with demo data: python3 scripts/seed.py [http://localhost:8000]
Members (password: conduit-demo-password): ana, ben, cleo."""
import sys

import httpx

api = httpx.Client(base_url=sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000", timeout=10)
PASSWORD = "conduit-demo-password"


def member(name, bio):
    r = api.post("/api/users", json={"user": {"username": name, "email": f"{name}@example.com", "password": PASSWORD}})
    if r.status_code == 409:
        r = api.post("/api/users/login", json={"user": {"email": f"{name}@example.com", "password": PASSWORD}})
    auth = {"Authorization": f"Token {r.json()['user']['token']}"}
    api.put("/api/user", json={"user": {"bio": bio}}, headers=auth)
    return auth


ana = member("ana", "Writes about tea and slow software.")
ben = member("ben", "Dragons, mostly.")
cleo = member("cleo", "Reads everything, comments on some of it.")

posts = [
    (ana, "Stories before code", "Why a requirement should fit in one sentence", "Write the scenario first. Then the test. Then the code.", ["storyspec", "process"]),
    (ana, "A proper cup of tea", "Temperature matters more than you think", "Green tea at 80°C, black at 95°C.", ["tea"]),
    (ben, "How to train your dragon", "Patience, mostly", "Start with small flames.", ["dragons", "training"]),
    (ben, "Dragons and tea", "An unlikely pairing", "Dragons prefer smoky lapsang.", ["dragons", "tea"]),
]
slugs = []
for author, title, description, body, tags in posts:
    r = api.post("/api/articles", json={"article": {"title": title, "description": description, "body": body, "tagList": tags}}, headers=author)
    slugs.append(r.json()["article"]["slug"])

api.post("/api/profiles/ben/follow", headers=ana)
api.post("/api/profiles/ana/follow", headers=cleo)
api.post(f"/api/articles/{slugs[2]}/favorite", headers=ana)
api.post(f"/api/articles/{slugs[0]}/favorite", headers=cleo)
api.post(f"/api/articles/{slugs[3]}/favorite", headers=cleo)
api.post(f"/api/articles/{slugs[0]}/comments", json={"comment": {"body": "One sentence is harder than it sounds."}}, headers=cleo)
api.post(f"/api/articles/{slugs[3]}/comments", json={"comment": {"body": "Smoky, of course."}}, headers=ana)
print(f"Seeded {len(slugs)} articles by ana and ben; cleo and ana follow, favorite and comment.")
