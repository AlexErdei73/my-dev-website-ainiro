const BASE_URL = "https://blog-api.alexerdei.co.uk";

async function getJSON(response) {
	let json;
	if (response.status === 401) {
		json = { success: false, errors: [{ msg: "Unauthorized" }] };
	} else json = await response.json();
	return json;
}

export async function login(username, password) {
	const response = await fetch(
		"https://alexerdei-team.us.ainiro.io/magic/modules/blog-api/login",
		{
			method: "POST",
			mode: "cors",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: username,
				password: password,
			}),
		}
	);
	const json = await response.json();
	//AINIRO response in case of error contains message field instead of msg
	if (!json.success) json.msg = json.message;
	//AINIRO returns an array as user
	json.user = json.user[0];
	//AINIRO database stores isAdmin as int and _id as user_id as default
	json.user._id = json.user.user_id;
	json.user.isAdmin = !!json.user.isAdmin;
	return json;
}

export async function updatePost(post, token) {
	const { _id, author, content, likes, title } = { ...post };
	const payload = {
		post_id: _id,
		author: author._id,
		content: JSON.stringify(content.map((block) => Number(block._id.slice(2)))),
		likes: JSON.stringify(likes),
		title,
	};
	const response = await fetch(
		`https://alexerdei-team.us.ainiro.io/magic/modules/blog-api/posts`,
		{
			method: "PUT",
			mode: "cors",
			headers: {
				"Content-Type": "application/json",
				Authorization: token,
			},
			body: JSON.stringify(payload),
		}
	);
	payload.likes = JSON.parse(payload.likes);
	payload.content = JSON.parse(payload.content);
	const res = {
		errors: [],
		success: true,
		post: payload,
	};
	if (response.status > 299) {
		const json = await response.json();
		res.success = false;
		res.errors.push({ msg: json.message });
	}
	return res;
}

export async function updateBlock(block, token) {
	console.log(block);
	const payload = { ...block };
	//In the UI block id cannot be number, so it
	//starts with "id", which we remove
	payload.block_id = payload._id.slice(2);
	delete payload._id;
	delete payload.errors;
	//AINIRO stores links as string
	payload.links = JSON.stringify(payload.links);
	const response = await fetch(
		`https://alexerdei-team.us.ainiro.io/magic/modules/blog-api/blocks`,
		{
			method: "PUT",
			mode: "cors",
			headers: {
				"Content-Type": "application/json",
				Authorization: token,
			},
			body: JSON.stringify(payload),
		}
	);
	const json = await response.json();
	const res = {
		errors: [],
		success: false,
	};
	if (response.status < 300) {
		//AINIRO response contain the _id as block_id
		delete block.block_id;
		//We cannot use numbers as _id for blocks
		//because it is index
		res.block = await getBlock(payload.block_id);
		res.success = true;
	} else {
		res.errors.push({ msg: json.message });
	}
	return res;
}

export async function getPost(ID) {
	const response = await fetch(
		`https://alexerdei-team.us.ainiro.io/magic/modules/blog-api/posts?posts.post_id.eq=${ID}`,
		{
			method: "GET",
			mode: "cors",
			headers: {
				"Content-Type": "application/json",
			},
		}
	);
	const jsonArr = await response.json();
	//AINIRO returns an array
	const json = jsonArr[0];
	//AINIRO returns null for empty array
	if (!json.content) json.content = [];
	if (!json.likes) json.likes = [];
	//AINIRO uses post_id instead of _id
	json._id = json.post_id;
	return json;
}

export async function createBlock(block, token) {
	const payload = { ...block };
	const res = {
		errors: [],
		block: payload,
		success: false,
	};
	delete payload.errors;
	payload.links = JSON.stringify(payload.links);
	const response = await fetch(
		"https://alexerdei-team.us.ainiro.io/magic/modules/blog-api/blocks",
		{
			method: "POST",
			mode: "cors",
			headers: {
				"Content-Type": "application/json",
				Authorization: token,
			},
			body: JSON.stringify(payload),
		}
	);
	const json = await response.json();
	if (response.status < 300 && json.id) {
		res.success = true;
		//The block _id cannot be number in the UI
		//because it is an index. We add "id" to it.
		res.block._id = "id" + json.id;
		res.block.links = JSON.parse(payload.links);
		return res;
	}
}

export async function deleteBlock(block, token) {
	const response = await fetch(
		`${BASE_URL}/posts/${block.post}/blocks/${block._id}`,
		{
			method: "DELETE",
			mode: "cors",
			headers: {
				"Content-Type": "application/json",
				Authorization: token,
			},
		}
	);
	return await getJSON(response);
}

export async function getPosts() {
	const response = await fetch(
		"https://alexerdei-team.us.ainiro.io/magic/modules/blog-api/posts",
		{
			method: "GET",
			mode: "cors",
			headers: {
				"Content-Type": "application/json",
			},
		}
	);
	//We get an array of posts
	const jsonArr = await response.json();
	//Popolate authors in posts
	for (let i = 0; i < jsonArr.length; i++) {
		const post = jsonArr[i];
		const author = await getAuthor(post.author);
		author._id = author.user_id;
		delete author.user_id;
		post.author = author;
		post._id = post.post_id;
		delete post.post_id;
		post.published = post.published ? !!post.published : false;
		post.likes = post.likes ? JSON.parse(post.likes) : [];
		post.content = post.content ? JSON.parse(post.content) : [];
		post.content = await getContent(post.content);
	}
	const res = {
		success: true,
		posts: jsonArr,
	};
	console.log(res);
	return res;
}

export async function postPosts(post, token) {
	//AINIRO stores content, likes as string
	post.content = JSON.stringify(post.content);
	post.likes = JSON.stringify(post.likes);
	const response = await fetch(
		`https://alexerdei-team.us.ainiro.io/magic/modules/blog-api/posts`,
		{
			method: "POST",
			mode: "cors",
			headers: {
				"Content-Type": "application/json",
				Authorization: token,
			},
			body: JSON.stringify(post),
		}
	);
	const json = await response.json();
	if (json.id) {
		json.success = true;
		json.post = await getPost(json.id);
		json._id = json.post_id;
		delete json.post_id;
	}
	return json;
}

export async function deletePosts(post, token) {
	const response = await fetch(`${BASE_URL}/posts/${post._id}`, {
		method: "DELETE",
		mode: "cors",
		headers: {
			"Content-Type": "application/json",
			Authorization: token,
		},
	});
	return await getJSON(response);
}

export async function createUser(user) {
	const response = await fetch(`${BASE_URL}/users`, {
		method: "POST",
		mode: "cors",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(user),
	});
	const json = await response.json();
	return json;
}

export async function updateUser(user, token) {
	const response = await fetch(`${BASE_URL}/users/${user._id}`, {
		method: "PUT",
		mode: "cors",
		headers: {
			"Content-Type": "application/json",
			Authorization: token,
		},
		body: JSON.stringify(user),
	});
	return await getJSON(response);
}

export async function updatePostLikes(postId, userId) {
	const response = await fetch(`${BASE_URL}/posts/${postId}/likes`, {
		method: "PUT",
		mode: "cors",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ user: userId }),
	});
	const json = await response.json();
	return json;
}

async function putPost(post, token) {
	post.likes = JSON.stringify(post.likes);
	post.content = JSON.stringify(post.content);
	const response = await fetch(
		"https://alexerdei-team.us.ainiro.io/magic/modules/blog-api/posts",
		{
			method: "PUT",
			mode: "cors",
			headers: {
				"Content-Type": "application/json",
				Authorization: token,
			},
			body: JSON.stringify(post),
		}
	);
	const json = await response.json();
	return json;
}

async function getAuthor(id) {
	const response = await fetch(
		`https://alexerdei-team.us.ainiro.io/magic/modules/blog-api/users?users.user_id.eq=${id}`,
		{
			mode: "cors",
			headers: {
				"Content-Type": "application/json",
			},
		}
	);
	const jsonArr = await response.json();
	//AINIRO returns an array
	const json = jsonArr[0];
	return json;
}

async function getBlock(ID) {
	const response = await fetch(
		`https://alexerdei-team.us.ainiro.io/magic/modules/blog-api/blocks?blocks.block_id.eq=${ID}`,
		{
			method: "GET",
			mode: "cors",
			headers: {
				"Content-Type": "application/json",
			},
		}
	);
	const jsonArr = await response.json();
	//AINIRO returns an array
	const json = jsonArr[0];
	const { block_id, type, language, text, links, post } = json;
	const res = {
		_id: `id${block_id}`,
		type,
		text,
		language,
		links: JSON.parse(links),
		post,
	};
	return res;
}

async function getContent(content) {
	const res = [];
	for (let i = 0; i < content.length; i++) {
		res.push(await getBlock(content[i]));
	}
	return res;
}
