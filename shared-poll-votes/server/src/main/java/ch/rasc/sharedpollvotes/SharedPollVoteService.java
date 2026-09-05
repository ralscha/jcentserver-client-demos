package ch.rasc.sharedpollvotes;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import ch.rasc.jcentserverclient.CentrifugoServerApiClient;

@Service
public class SharedPollVoteService {

	static final String CHANNEL = "post_votes:feed";

	private final Map<String, VoteItem> posts = new LinkedHashMap<>();

	private final CentrifugoServerApiClient centrifugoServerApiClient;

	public SharedPollVoteService(CentrifugoServerApiClient centrifugoServerApiClient) {
		this.centrifugoServerApiClient = centrifugoServerApiClient;
		addPost("post-aurora", "Aurora deployment checklist", "platform", 18);
		addPost("post-reef", "Realtime dashboards without bespoke polling", "product", 11);
		addPost("post-slate", "Postgres as the messaging plane", "infra", 24);
		addPost("post-copper", "When to choose map subscriptions", "architecture", 9);
		addPost("post-mint", "UI state that heals after reconnect", "frontend", 15);
	}

	public synchronized List<VoteItem> posts() {
		return List.copyOf(this.posts.values());
	}

	public synchronized VoteItem vote(String key) {
		VoteItem current = this.posts.get(key);
		if (current == null) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown post: " + key);
		}
		VoteItem updated = new VoteItem(current.key(), current.title(), current.category(), current.votes() + 1,
				current.version() + 1);
		this.posts.put(key, updated);
		publish(updated);
		return updated;
	}

	public synchronized Map<String, Object> refresh(RefreshRequest request) {
		List<Map<String, Object>> items = new ArrayList<>();
		for (TrackedItem item : request.items()) {
			VoteItem post = this.posts.get(item.key());
			if (post != null && post.version() > item.version()) {
				items.add(Map.of("key", post.key(), "data", post, "version", post.version()));
			}
		}
		return Map.of("result", Map.of("items", items));
	}

	private void addPost(String key, String title, String category, long votes) {
		this.posts.put(key, new VoteItem(key, title, category, votes, 1));
	}

	private void publish(VoteItem post) {
		this.centrifugoServerApiClient.map()
			.sharedPollPublish(builder -> builder.channel(CHANNEL).key(post.key()).data(post).version(post.version()));
	}

	public record VoteItem(String key, String title, String category, long votes, long version) {
	}

	public record RefreshRequest(String channel, List<TrackedItem> items) {
		public RefreshRequest {
			items = items == null ? List.of() : items;
		}
	}

	public record TrackedItem(String key, Long version) {
		public TrackedItem {
			version = version == null ? 0 : version;
		}
	}

}
