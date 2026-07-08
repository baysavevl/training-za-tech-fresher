package com.zalo.training.conversation.adapter;

import org.springframework.stereotype.Component;

@Component
public class MockActionAdapter implements ActionAdapter {

    @Override
    public ActionResult execute(String actionName, String input) {
        if ("ORDER_LOOKUP".equalsIgnoreCase(actionName)) {
            return new ActionResult(true, "Order A123 dang duoc xu ly.", "{\"orderId\":\"A123\",\"status\":\"PROCESSING\"}");
        }
        if ("TICKET_CREATION".equalsIgnoreCase(actionName)) {
            return new ActionResult(true, "Ticket ho tro da duoc tao.", "{\"ticketId\":\"TCK-1001\"}");
        }
        return new ActionResult(false, "Action khong kha dung.", "{\"error\":\"unknown_action\"}");
    }
}
