const BASE_URL = "https://alexerdei-team.us.ainiro.io/magic/modules/blog-api/";

async function getJSON(response) {
	const json = await response.json();
	const res = {
		success: true,
		errors: [],
		response: json
	}
 	if (response.status >= 300) {
		res.success = false; 
		res.errors.push({ msg: json.message || json });
	}
	return res;
}

export async function login(username, password) {
	const response = await fetch(
		`${BASE_URL}login`,
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
	const { _id, author, content, likes, title, published } = post;
	const payload = {
		post_id: _id,
		author: author._id,
		content: JSON.stringify(content.map((block) => Number(block._id.slice(2)))),
		likes: JSON.stringify(likes),
		title,
		published
	};
	const response = await fetch(
		`${BASE_URL}posts`,
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
	const json = await getJSON(response);
	payload.likes = JSON.parse(payload.likes);
	payload.content = JSON.parse(payload.content);
	const res = {
		errors: json.errors,
		success: json.success,
		post: payload,
	};
	return res;
}

export async function updateBlock(block, token) {
	const payload = {
		block_id: block._id.slice(2),
		links: JSON.stringify(block.links),
		type: block.type,
		text: block.text,
		post: block.post
	};
	const response = await fetch(
		`${BASE_URL}blocks`,
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
	const json = getJSON(response);
	const res = {
		errors: json.errors,
		success: json.success,
	};
	if (res.success) {
		//AINIRO response contain the _id as block_id
		delete block.block_id;
		const json = await getBlock(payload.block_id);
		if (!json.success) {
			res.success = false;
			res.errors.push(json.errors[0]);
		} else {
			res.block = json.block;
		}
	}
	return res;
}

export async function getPost(id) {
	const response = await fetch(
		`${BASE_URL}posts?posts.post_id.eq=${id}`,
		{
			method: "GET",
			mode: "cors",
			headers: {
				"Content-Type": "application/json",
			},
		}
	);
	const json = await getJSON(response);
	const res = {
		errors: json.errors,
		success: json.success,
	}
	if (res.success) {
		res.post = json.response[0];
		//AINIRO returns null for empty array
		if (!res.post.content) res.post.content = [];
		if (!res.post.likes) res.post.likes = [];
		//AINIRO uses post_id instead of _id
		res.post._id = res.post.post_id;
		delete res.post.post_id;
	}
	return res;
}

export async function createBlock(block, token) {
	const payload = {
		post: block.post,
		type: block.type,
		text: block.text,
		links: JSON.stringify(block.links),
	};
	const response = await fetch(
		`${BASE_URL}blocks`,
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
	const json = await getJSON(response);
	const res = {
		success: json.success,
		errors: json.errors,
	}
	if (res.success) {		
		res.block = {
			_id: "id" + json.response.id,
			post: payload.post,
			type: payload.type,
			text: payload.text,
			links: JSON.parse(payload.links)
		}
	}
	return res;
}

export async function deleteBlock(block, token) {
	const id = Number(block._id.slice(2));
	let response = await fetch(
		`${BASE_URL}blocks?block_id=${id}`,
		{
			method: "DELETE",
			mode: "cors",
			headers: {
				"Content-Type": "application/json",
				Authorization: token,
			},
		}
	);
	let json = await getJSON(response);
	const res = {
		success: json.success,
		errors: json.errors,
		block: block
	}
	if (!json.success) return res;
	json = await getPost(block.post);
	if (!json.success) {
		res.success = false;
		res.errors = json.errors;
		return res;
	}
	const post = json.post;
	const postContent = JSON.parse(post.content);
	const blockIndex = postContent.indexOf(id);
	postContent.splice(blockIndex, 1);
	const payload = {
		post_id: post._id,
		content: JSON.stringify(postContent)
	}
	response = await fetch(
		`${BASE_URL}posts`,
		{
			method: "PUT",
			mode: "cors",
			headers: {
				"Content-Type": "application/json",
				Authorization: token,
			},
			body: JSON.stringify(payload)
		}
	);
	json = await getJSON(response);
	if (!json.success) {
		res.success = false;
		res.errors = json.errors;
		return res;
	}
	return res;
}

export async function getPosts() {
	const response = await fetch(
		`${BASE_URL}posts`,
		{
			method: "GET",
			mode: "cors",
			headers: {
				"Content-Type": "application/json",
			},
		}
	);
	const json = await getJSON(response);
	const res = {
		success: json.success,
		errors: json.errors,
	}
	if (res.success) { 
		//We get an array of posts
		const jsonArr = json.response;
		//Popolate authors and content in posts
		for (let i = 0; i < jsonArr.length; i++) {
			const post = jsonArr[i];
			let json = await getAuthor(post.author);
			if (!json.success) {
				res.success = false;
				res.errors.push(json.errors[0]);
				return res;
			}
			const author = json.author;
			author._id = author.user_id;
			delete author.user_id;
			post.author = author;
			post._id = post.post_id;
			delete post.post_id;
			post.published = post.published ? !!post.published : false;
			post.likes = post.likes ? JSON.parse(post.likes) : [];
			post.content = post.content ? JSON.parse(post.content) : [];
			json = await getContent(post.content);
			if (!json.success) {
				res.success = false;
				res.errors.push(json.errors[0]);
				return res;
			}
			post.content = json.content;
		}
		res.posts = jsonArr;
	}
	console.log(res);
	return res;
}

export async function postPosts(post, token) {
	//AINIRO stores content, likes as string
	const payload = {
		title: post.title,
		author: post.author,
		content: JSON.stringify(post.content),
		likes: JSON.stringify(post.likes),
	}
	const response = await fetch(
		`${BASE_URL}posts`,
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
	let json = await getJSON(response);
	const res = {
		success: json.success,
		errors: json.errors,
	}
	if (!res.success) {
		return res;
	}
	json = await getPost(json.id);
	if (!json.success) {
		res.success = false;
		res.errors.push(json.errors[0]);
		return res;
	}
	res.post = {
		_id: json.response.post_id,
		author: json.response.author,
		title: json.response.title,
		content: JSON.parse(json.response.content),
		likes: JSON.parse(json.response.likes),
		createdAt: json.response.createdAt,
		updatedAt: json.response.updatedAt
	}
	return res;
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
	const json = await getJSON(response);
	const res = {
		success: json.success,
		errors: json.errors,
	}
	if (!res.success) return res;
	//AINIRO returns an array
	res.author = json.response[0];
	return res;
}

async function getBlock(ID) {
	const response = await fetch(
		`${BASE_URL}blocks?blocks.block_id.eq=${ID}`,
		{
			method: "GET",
			mode: "cors",
			headers: {
				"Content-Type": "application/json",
			},
		}
	);
	const json = await getJSON(response);
	const res = {
		success: json.success,
		errors: json.errors,
	}
	if (!res.success) return res;
	const { block_id, type, language, text, links, post } = json.response[0];
	const block = {
		_id: `id${block_id}`,
		type,
		text,
		language,
		links: JSON.parse(links),
		post,
	};
	res.block = block;
	return res;
}

async function getContent(content) {
	const res = {};
	res.content = [];
	for (let i = 0; i < content.length; i++) {
		const response = await getBlock(content[i]);
		if (!response.success) {
			res.success = false;
			res.errors = response.errors;
			return res;
		}
		res.content.push(response.block);
	}
	res.success = true;
	res.errors = [];
	return res;
}
