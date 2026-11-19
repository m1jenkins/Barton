# Screen brief: does this Reddit post weigh the two cars?

Each line of your input file is one Reddit post: `id | subreddit | date | title || start of post (cut at 500 characters)`. Every post names both cars below somewhere in its title or text.
Decide for each post whether it WEIGHS the two: the poster (or the post) is choosing between them, comparing them, asking which to buy, asking for opinions on one with the other as a
named alternative, or an owner/shopper explains why they picked one over the other. Mark it NOT weighing when the second car is only a passing mention (an earlier car the poster owned,
"my wife's old CR-V", a list of unrelated things, a repair question that happens to name another car), or when a name is not the car (Colorado the state, Tacoma the city,
Sierra the mountains, a different Ford or GMC product, the F-150 Lightning only), or the post is an ad, spam or a photo post with no question or opinion.
Posts that are cut off: judge from the title and what is shown. When unsure, keep it (weighs = true).

Output: write a JSON file (path in your prompt) shaped `{"<post id>": true|false, ...}` with every id in the input exactly once, validate it with `node -e`, and reply with the path plus the counts kept and dropped. Do not output post text.
