package com.strategyquant.userplugins.autorename;

import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.servlet.ServletContextHandler;
import org.eclipse.jetty.servlet.ServletHolder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.strategyquant.pluginlib.ISQPlugin;
import com.strategyquant.pluginlib.annotations.Category;
import com.strategyquant.pluginlib.annotations.License;
import com.strategyquant.pluginlib.annotations.Name;
import com.strategyquant.pluginlib.annotations.ShortDesc;
import com.strategyquant.tradinglib.servlet.IServletPlugin;

import net.xeoh.plugins.base.annotations.PluginImplementation;
import net.xeoh.plugins.base.annotations.meta.Author;

@Author(name = "AutoRename")
@Name(name = "Auto Rename")
@Category(name = "DatabankActions")
@License(text = "")
@ShortDesc(text = "Auto-renames selected strategies as Style_Ticker_TF_001")
@PluginImplementation
public class AutoRenamePlugin implements ISQPlugin, IServletPlugin {

    public static final Logger Log = LoggerFactory.getLogger(AutoRenamePlugin.class);

    private ServletContextHandler context;
    private AutoRenameServlet servlet;

    @Override
    public Handler getHandler() {
        if (context == null) {
            context = new ServletContextHandler(ServletContextHandler.SESSIONS);
            context.setContextPath("/autorename/");
            context.addServlet(new ServletHolder(servlet), "/*");
        }
        return context;
    }

    @Override
    public String getProduct() {
        return "SQUANT";
    }

    @Override
    public int getPreferredPosition() {
        return 0;
    }

    @Override
    public void initPlugin() throws Exception {
        this.servlet = new AutoRenameServlet();
    }
}
