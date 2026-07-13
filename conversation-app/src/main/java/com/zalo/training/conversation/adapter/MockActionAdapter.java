package com.zalo.training.conversation.adapter;

import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class MockActionAdapter implements ActionAdapter {

    private static final Pattern ORDER_ID_PATTERN = Pattern.compile("\\b([A-Z][0-9]{3,})\\b", Pattern.CASE_INSENSITIVE);

    @Override
    public ActionResult execute(String actionName, String input) {
        String orderId = extractOrderId(input);
        if ("ORDER_LOOKUP".equalsIgnoreCase(actionName)) {
            return new ActionResult(
                    true,
                    "Order %s is PACKING. Reply update for the latest status, ticket to create a follow-up, or done.".formatted(orderId),
                    "{\"category\":\"ORDER_STATUS\",\"orderId\":\"%s\",\"status\":\"PACKING\",\"nextQuestion\":\"update|ticket|done\"}".formatted(orderId)
            );
        }
        if ("ORDER_STATUS_UPDATE".equalsIgnoreCase(actionName)) {
            return new ActionResult(
                    true,
                    "Update: order %s moved from PACKING to SHIPPING. Do you want me to create a follow-up ticket?".formatted(orderId),
                    "{\"category\":\"ORDER_STATUS_UPDATE\",\"orderId\":\"%s\",\"previousStatus\":\"PACKING\",\"status\":\"SHIPPING\",\"nextQuestion\":\"yes|no\"}".formatted(orderId)
            );
        }
        if ("TICKET_CREATION".equalsIgnoreCase(actionName)) {
            return new ActionResult(
                    true,
                    "Ticket TCK-1001 was created for order %s. A support specialist can follow up with shipping updates.".formatted(orderId),
                    "{\"category\":\"TICKET_CREATION\",\"orderId\":\"%s\",\"ticketId\":\"TCK-1001\",\"status\":\"CREATED\"}".formatted(orderId)
            );
        }
        return new ActionResult(false, "Action khong kha dung.", "{\"error\":\"unknown_action\"}");
    }

    private String extractOrderId(String input) {
        Matcher matcher = ORDER_ID_PATTERN.matcher(input == null ? "" : input);
        if (matcher.find()) {
            return matcher.group(1).toUpperCase(Locale.ROOT);
        }
        return "UNKNOWN";
    }
}
