package ch.rasc.pgorders;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class OrderService {

	static final String CHANNEL = "pg_orders:kitchen";

	private final JdbcTemplate jdbcTemplate;

	private final TransactionTemplate transactionTemplate;

	public OrderService(JdbcTemplate jdbcTemplate, TransactionTemplate transactionTemplate) {
		this.jdbcTemplate = jdbcTemplate;
		this.transactionTemplate = transactionTemplate;
	}

	@Bean
	ApplicationRunner initializeOrders() {
		return args -> {
			this.jdbcTemplate.execute("""
					create table if not exists kitchen_order (
					  id bigserial primary key,
					  item text not null,
					  station text not null,
					  status text not null,
					  created_at timestamptz not null default now()
					)
					""");
		};
	}

	public StateSnapshot state() {
		StreamPosition position = streamPosition();
		List<KitchenOrder> orders = this.jdbcTemplate.query(
				"select id, item, station, status, created_at from kitchen_order order by id desc limit 30",
				this::mapOrder);
		return new StateSnapshot(position, orders);
	}

	public KitchenOrder createOrder(NewOrderRequest request) {
		return this.transactionTemplate.execute(status -> {
			KitchenOrder order = this.jdbcTemplate.queryForObject("""
					insert into kitchen_order (item, station, status)
					values (?, ?, 'queued')
					returning id, item, station, status, created_at
					""", this::mapOrder, request.item(), request.station());
			publish("created", order);
			return order;
		});
	}

	public KitchenOrder advance(long id) {
		return this.transactionTemplate.execute(status -> {
			KitchenOrder current = this.jdbcTemplate.queryForObject(
					"select id, item, station, status, created_at from kitchen_order where id = ?", this::mapOrder,
					id);
			String next = switch (current.status()) {
				case "queued" -> "preparing";
				case "preparing" -> "ready";
				default -> "served";
			};
			KitchenOrder updated = this.jdbcTemplate.queryForObject("""
					update kitchen_order set status = ?
					where id = ?
					returning id, item, station, status, created_at
					""", this::mapOrder, next, id);
			publish("updated", updated);
			return updated;
		});
	}

	private void publish(String type, KitchenOrder order) {
		this.jdbcTemplate.queryForMap("""
				select * from cf_stream_publish(
				  p_channel => ?,
				  p_data => ?::jsonb
				)
				""", CHANNEL,
				"""
						{"type":"%s","order":{"id":%d,"item":"%s","station":"%s","status":"%s","createdAt":"%s"}}
						""".formatted(type, order.id(), json(order.item()), json(order.station()), order.status(),
						order.createdAt()));
	}

	private StreamPosition streamPosition() {
		Map<String, Object> row = this.jdbcTemplate.queryForMap("select * from cf_stream_top_position(?)", CHANNEL);
		Number offset = (Number) row.getOrDefault("offset", 0);
		String epoch = String.valueOf(row.getOrDefault("epoch", ""));
		return new StreamPosition(offset.longValue(), epoch);
	}

	private KitchenOrder mapOrder(ResultSet rs, int rowNum) throws SQLException {
		return new KitchenOrder(rs.getLong("id"), rs.getString("item"), rs.getString("station"),
				rs.getString("status"), rs.getObject("created_at", OffsetDateTime.class).toInstant().toString());
	}

	private String json(String value) {
		return value.replace("\\", "\\\\").replace("\"", "\\\"");
	}

	public record StreamPosition(long offset, String epoch) {
	}

	public record StateSnapshot(StreamPosition position, List<KitchenOrder> orders) {
	}

	public record KitchenOrder(long id, String item, String station, String status, String createdAt) {
	}

	public record NewOrderRequest(String item, String station) {
	}

}
