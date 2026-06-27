package ch.rasc.pgorders;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;

@RestController
public class OrderController {

	private final OrderService orderService;

	private final Algorithm algorithmHS;

	public OrderController(OrderService orderService, CentrifugoProperties centrifugoProperties) {
		this.orderService = orderService;
		this.algorithmHS = Algorithm.HMAC512(centrifugoProperties.hmacSecret());
	}

	@GetMapping("/centrifugo-token")
	public String token() {
		return JWT.create().withSubject("pg-orders").sign(this.algorithmHS);
	}

	@GetMapping("/orders/state")
	public OrderService.StateSnapshot state() {
		return this.orderService.state();
	}

	@PostMapping("/orders")
	public OrderService.KitchenOrder create(@RequestBody OrderService.NewOrderRequest request) {
		return this.orderService.createOrder(request);
	}

	@PostMapping("/orders/{id}/advance")
	public OrderService.KitchenOrder advance(@PathVariable long id) {
		return this.orderService.advance(id);
	}

}
